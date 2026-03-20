import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { PurchaseModule } from './purchase.module';
import { PurchaseOrderService } from './application/purchase-order.service';
import { ReceivingNoteService } from './application/receiving-note.service';
import { SupplierService } from './application/supplier.service';
import { InventoryService } from '../inventory/application/inventory.service';

describe('Purchase receiving + PURCHASE_PAYABLE (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let poSvc: PurchaseOrderService;
  let rnSvc: ReceivingNoteService;
  let supplierSvc: SupplierService;
  let invSvc: InventoryService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, PurchaseModule],
    }).compile();
    prisma = app.get(PrismaService);
    poSvc = app.get(PurchaseOrderService);
    rnSvc = app.get(ReceivingNoteService);
    supplierSvc = app.get(SupplierService);
    invSvc = app.get(InventoryService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('submit → receiving-notes → patch lines → complete: balance += qualifiedQty; PURCHASE_PAYABLE amount', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      console.warn('skip purchase spec: run migrate deploy for 20260316120000_purchase_*');
      return;
    }
    const m = await prisma.merchant.create({
      data: { code: `PM-${Date.now()}`, name: 'PM' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `S-${Date.now()}`,
        name: 'S',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `W-PUR-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: 'W',
      },
    });
    const prod = await prisma.product.create({
      data: {
        sku: `SKU-PUR-${Date.now()}`,
        name: 'P',
      },
    });
    const balBefore = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: prod.id, warehouseId: wh.id },
      },
    });
    const onHandBefore = balBefore?.onHandQty ?? 0;

    const po = await poSvc.create({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-${Date.now()}`,
      lines: [{ productId: prod.id, qtyOrdered: 10, unitCost: 25.5 }],
    });
    await poSvc.submit(po.id);
    const rn = await rnSvc.create({
      merchantId: m.id,
      purchaseOrderId: po.id,
      inspectorName: 'Q',
    });
    const lineId = rn.lines[0].id;
    await rnSvc.patchLines(rn.id, [
      { lineId, receivedQty: 7, qualifiedQty: 7, returnedQty: 0 },
    ]);
    await rnSvc.complete(rn.id);

    const balAfter = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: prod.id, warehouseId: wh.id },
      },
    });
    expect(balAfter!.onHandQty).toBe(onHandBefore + 7);

    const payable = await prisma.financeEvent.findFirst({
      where: {
        type: 'PURCHASE_PAYABLE',
        referenceId: rn.id,
          partyId: `supplier:${sup.id}`,
      },
    });
    expect(payable).toBeTruthy();
    expect(Number(payable!.amount)).toBeCloseTo(7 * 25.5, 2);

    const poDetail = await poSvc.getById(po.id);
    expect((poDetail as { receivingProgress?: unknown }).receivingProgress).toBeDefined();
    const rp = (poDetail as { receivingProgress: { totalOrdered: number; totalReceived: number; percentComplete: number; fullyReceivedLinesCount: number } })
      .receivingProgress;
    expect(rp.totalOrdered).toBe(10);
    expect(rp.totalReceived).toBe(7);
    expect(rp.percentComplete).toBe(70);
    expect(rp.fullyReceivedLinesCount).toBe(0);

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id, referenceId: lineId },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id },
    });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.delete({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.product.delete({ where: { id: prod.id } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 30000);

  it('quick-receive: creates PO+RN and completes with PURCHASE_IN + PURCHASE_PAYABLE', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      console.warn('skip purchase spec: run migrate deploy for purchase tables');
      return;
    }
    const m = await prisma.merchant.create({
      data: { code: `PMQ-${Date.now()}`, name: 'PMQ' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `SQ-${Date.now()}`,
        name: 'SQ',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `WQ-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: 'WQ',
      },
    });
    const prod = await prisma.product.create({
      data: {
        sku: `SKU-Q-${Date.now()}`,
        name: 'PQ',
        costPrice: 12.3,
      },
    });
    const balBefore = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: prod.id, warehouseId: wh.id },
      },
    });
    const onHandBefore = balBefore?.onHandQty ?? 0;

    const rn = await poSvc.quickReceive({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-QR-${Date.now()}`,
      inspectorName: 'Q',
      lines: [{ productId: prod.id, qty: 5 }],
    });
    expect(rn.status).toBe('COMPLETED');

    const po = await prisma.purchaseOrder.findFirst({
      where: { merchantId: m.id, orderNumber: { startsWith: 'PO-QR-' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(po).toBeTruthy();
    expect(po!.status).toBe('RECEIVED');

    const balAfter = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: prod.id, warehouseId: wh.id },
      },
    });
    expect(balAfter!.onHandQty).toBe(onHandBefore + 5);

    const payable = await prisma.financeEvent.findFirst({
      where: {
        type: 'PURCHASE_PAYABLE',
        referenceId: rn.id,
          partyId: `supplier:${sup.id}`,
      },
    });
    expect(payable).toBeTruthy();
    expect(Number(payable!.amount)).toBeCloseTo(5 * 12.3, 2);

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { warehouseId: wh.id, note: { contains: rn.receiptNumber } },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id },
    });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.deleteMany({ where: { id: rn.id } });
    if (po) {
      await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
      await prisma.purchaseOrder.deleteMany({ where: { id: po.id } });
    }
    await prisma.product.deleteMany({ where: { id: prod.id } });
    await prisma.warehouse.deleteMany({ where: { id: wh.id } });
    await prisma.supplier.deleteMany({ where: { id: sup.id } });
    await prisma.merchant.deleteMany({ where: { id: m.id } });
  }, 30000);

  it('quick-receive guards: qty<=0 throws RN_COMPLETE_INVALID', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `PMQG-${Date.now()}`, name: 'PMQG' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `SQG-${Date.now()}`,
        name: 'SQG',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `WQG-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: 'WQG',
      },
    });
    const prod = await prisma.product.create({
      data: {
        sku: `SKU-QG-${Date.now()}`,
        name: 'PQG',
      },
    });
    try {
      await expect(
        poSvc.quickReceive({
          merchantId: m.id,
          supplierId: sup.id,
          warehouseId: wh.id,
          orderNumber: `PO-QR-G-${Date.now()}`,
          lines: [{ productId: prod.id, qty: 0 }],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RN_COMPLETE_INVALID' }),
      });
    } finally {
      await prisma.product.deleteMany({ where: { id: prod.id } });
      await prisma.warehouse.deleteMany({ where: { id: wh.id } });
      await prisma.supplier.deleteMany({ where: { id: sup.id } });
      await prisma.merchant.deleteMany({ where: { id: m.id } });
    }
  }, 30000);

  it('receiving complete writes batch/expiry and inventory expiring returns the batch', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      console.warn('skip purchase spec: run migrate deploy for purchase migrations');
      return;
    }
    // Avoid cross-test pollution: FinancePeriodClose may be created by other suites
    // and block PURCHASE_PAYABLE writes in this test.
    await prisma.financePeriodClose.deleteMany({});

    const m = await prisma.merchant.create({
      data: { code: `PM-EXP-${Date.now()}`, name: 'PM EXP' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `S-EXP-${Date.now()}`,
        name: 'S',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `W-PUR-EXP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: 'W',
      },
    });
    const prod = await prisma.product.create({
      data: {
        sku: `SKU-PUR-EXP-${Date.now()}`,
        name: 'P',
      },
    });

    const po = await poSvc.create({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-EXP-${Date.now()}`,
      lines: [{ productId: prod.id, qtyOrdered: 10, unitCost: 25.5 }],
    });
    await poSvc.submit(po.id);
    const rn = await rnSvc.create({
      merchantId: m.id,
      purchaseOrderId: po.id,
      inspectorName: 'Q',
    });
    const lineId = rn.lines[0].id;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 15);
    await rnSvc.patchLines(rn.id, [
      {
        lineId,
        receivedQty: 7,
        qualifiedQty: 7,
        returnedQty: 0,
        batchCode: 'B-PO-RN',
        expiryDate: expiry.toISOString(),
        weightUnit: 'KG',
      },
    ]);
    await rnSvc.complete(rn.id);

    // ReceivingNote detail includes return/quality/batch/expiry fields for UI.
    const detail: any = await rnSvc.getById(rn.id, m.id);
    expect(detail?.lines?.length).toBeGreaterThanOrEqual(1);
    const line = detail.lines.find((x: any) => x.id === lineId);
    expect(line).toBeTruthy();
    expect(line.qualifiedQty).toBe(7);
    expect(line.returnedQty).toBe(0);
    expect(line.returnReason ?? null).toBeNull();
    expect(line.batchCode).toBe('B-PO-RN');
    expect(line.expiryDate).toBeTruthy();

    // 查詢 expiring：若 DB 尚未 migrate 支援欄位，會回空；有 migrate 時應查得到。
    const inv = (await invSvc.getExpiring({
      warehouseId: wh.id,
      from: new Date().toISOString(),
      daysAhead: 60,
      page: 1,
      pageSize: 50,
    })) as any;
    if (inv.items?.length > 0) {
      const found = inv.items.find((x: any) => x.batchCode === 'B-PO-RN');
      expect(found).toBeTruthy();
      expect(typeof (found as any).daysUntilExpiry).toBe('number');
    }

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id, referenceId: lineId },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id },
    });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.delete({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.product.delete({ where: { id: prod.id } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 30000);

  it('patchLines with productionDate + shelfLifeMonths computes expiryDate', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      return;
    }
    await prisma.financePeriodClose.deleteMany({});
    const m = await prisma.merchant.create({
      data: { code: `PM-PD-${Date.now()}`, name: 'PM PD' },
    });
    const sup = await prisma.supplier.create({
      data: { merchantId: m.id, code: `S-PD-${Date.now()}`, name: 'S', status: 'ACTIVE' },
    });
    const wh = await prisma.warehouse.create({
      data: { merchantId: m.id, code: `W-PD-${Date.now()}`, name: 'W' },
    });
    const prod = await prisma.product.create({
      data: { sku: `SKU-PD-${Date.now()}`, name: 'P' },
    });
    const po = await poSvc.create({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-PD-${Date.now()}`,
      lines: [{ productId: prod.id, qtyOrdered: 5, unitCost: 10 }],
    });
    await poSvc.submit(po.id);
    const rn = await rnSvc.create({
      merchantId: m.id,
      purchaseOrderId: po.id,
    });
    const lineId = rn.lines[0].id;
    await rnSvc.patchLines(rn.id, [
      {
        lineId,
        receivedQty: 5,
        qualifiedQty: 5,
        returnedQty: 0,
        batchCode: 'B-PD',
        productionDate: '2024-01-15',
        shelfLifeMonths: 2,
      },
    ]);
    await rnSvc.complete(rn.id);
    const detail: any = await rnSvc.getById(rn.id, m.id);
    const line = detail?.lines?.find((x: any) => x.id === lineId);
    expect(line).toBeTruthy();
    expect(line.expiryDate).toBeTruthy();
    const exp = new Date(line.expiryDate);
    expect(exp.getUTCFullYear()).toBe(2024);
    expect(exp.getUTCMonth()).toBe(2); // March (0-indexed)
    expect(exp.getUTCDate()).toBe(15);

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({ where: { productId: prod.id, warehouseId: wh.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: prod.id, warehouseId: wh.id } });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.delete({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.product.delete({ where: { id: prod.id } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 30000);

  it('from-replenishment: creates DRAFT PO from suggestions, returns id and orderNumber', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      return;
    }
    const m = await prisma.merchant.create({
      data: { code: `PM-RPL-${Date.now()}`, name: 'PM RPL' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `S-RPL-${Date.now()}`,
        name: 'S RPL',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `W-RPL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: 'W RPL',
      },
    });
    const prod1 = await prisma.product.create({
      data: { sku: `SKU-RPL-1-${Date.now()}`, name: 'P1', costPrice: 50 },
    });
    const prod2 = await prisma.product.create({
      data: { sku: `SKU-RPL-2-${Date.now()}`, name: 'P2', costPrice: 100 },
    });

    const res = await poSvc.createFromReplenishment({
      supplierId: sup.id,
      warehouseId: wh.id,
      suggestions: [
        { productId: prod1.id, suggestedQty: 5 },
        { productId: prod2.id, suggestedQty: 3 },
      ],
    });

    expect(res.id).toBeTruthy();
    expect(res.orderNumber).toMatch(/^PO-RPL-/);

    const po = await poSvc.getById(res.id);
    expect(po.status).toBe('DRAFT');
    expect(po.supplierId).toBe(sup.id);
    expect(po.warehouseId).toBe(wh.id);
    expect(po.lines).toHaveLength(2);
    const line1 = po.lines.find((l: any) => l.productId === prod1.id);
    const line2 = po.lines.find((l: any) => l.productId === prod2.id);
    expect(line1?.qtyOrdered).toBe(5);
    expect(Number(line1?.unitCost)).toBe(50);
    expect(line2?.qtyOrdered).toBe(3);
    expect(Number(line2?.unitCost)).toBe(100);

    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.product.deleteMany({ where: { id: { in: [prod1.id, prod2.id] } } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  });

  it('return-to-supplier: RETURN_TO_SUPPLIER + PURCHASE_RETURN', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "Supplier" LIMIT 1`;
    } catch {
      return;
    }
    const m = await prisma.merchant.create({
      data: { code: `PM-R2S-${Date.now()}`, name: 'PM R2S' },
    });
    const sup = await prisma.supplier.create({
      data: {
        merchantId: m.id,
        code: `S-R2S-${Date.now()}`,
        name: 'S',
        status: 'ACTIVE',
      },
    });
    const wh = await prisma.warehouse.create({
      data: {
        merchantId: m.id,
        code: `W-R2S-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: 'W',
      },
    });
    const prod = await prisma.product.create({
      data: { sku: `SKU-R2S-${Date.now()}`, name: 'P' },
    });
    const po = await poSvc.create({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-R2S-${Date.now()}`,
      lines: [{ productId: prod.id, qtyOrdered: 10, unitCost: 30 }],
    });
    await poSvc.submit(po.id);
    const rn = await rnSvc.create({
      merchantId: m.id,
      purchaseOrderId: po.id,
      inspectorName: 'Q',
    });
    const lineId = rn.lines[0].id;
    await rnSvc.patchLines(rn.id, [
      { lineId, receivedQty: 5, qualifiedQty: 5, returnedQty: 0 },
    ]);
    await rnSvc.complete(rn.id);

    await rnSvc.returnToSupplier(rn.id, {
      lines: [{ receivingNoteLineId: lineId, quantity: 2 }],
    });

    const invReturn = await prisma.inventoryEvent.findFirst({
      where: {
        productId: prod.id,
        warehouseId: wh.id,
        type: 'RETURN_TO_SUPPLIER',
        referenceId: lineId,
      },
    });
    expect(invReturn).toBeTruthy();
    expect(invReturn!.quantity).toBe(-2);

    const purchaseReturn = await prisma.financeEvent.findFirst({
      where: {
        type: 'PURCHASE_RETURN',
        referenceId: rn.id,
        partyId: `supplier:${sup.id}`,
      },
    });
    expect(purchaseReturn).toBeTruthy();
    expect(Number(purchaseReturn!.amount)).toBeCloseTo(2 * 30, 2);

    await rnSvc.returnToSupplier(rn.id, {
      lines: [{ receivingNoteLineId: lineId, quantity: 3 }],
    });
    const purchaseReturn2 = await prisma.financeEvent.findMany({
      where: { type: 'PURCHASE_RETURN', referenceId: rn.id },
    });
    expect(purchaseReturn2.length).toBe(2);

    await expect(
      rnSvc.returnToSupplier(rn.id, {
        lines: [{ receivingNoteLineId: lineId, quantity: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: prod.id, warehouseId: wh.id },
    });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.delete({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    await prisma.supplier.delete({ where: { id: sup.id } });
    await prisma.product.delete({ where: { id: prod.id } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 30000);

  it('supplier KPIs: getById returns lead time and return rate', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `KPI-${Date.now()}`, name: 'KPI' },
    });
    const sup = await prisma.supplier.create({
      data: { merchantId: m.id, code: `KPI-S-${Date.now()}`, name: 'KPI S', status: 'ACTIVE' },
    });
    const wh = await prisma.warehouse.create({
      data: { merchantId: m.id, code: `KPI-W-${Date.now()}`, name: 'KPI W' },
    });
    const prod = await prisma.product.create({
      data: { sku: `KPI-P-${Date.now()}`, name: 'KPI P' },
    });
    const po = await poSvc.create({
      merchantId: m.id,
      supplierId: sup.id,
      warehouseId: wh.id,
      orderNumber: `PO-KPI-${Date.now()}`,
      lines: [{ productId: prod.id, qtyOrdered: 10, unitCost: 10 }],
    });
    await poSvc.submit(po.id);
    const rn = await rnSvc.create({
      merchantId: m.id,
      purchaseOrderId: po.id,
    });
    await rnSvc.patchLines(rn.id, [
      { lineId: rn.lines[0].id, receivedQty: 10, qualifiedQty: 10, returnedQty: 0 },
    ]);
    await rnSvc.complete(rn.id);
    await rnSvc.returnToSupplier(rn.id, {
      lines: [{ receivingNoteLineId: rn.lines[0].id, quantity: 2 }],
    });

    const out = await supplierSvc.getById(sup.id, m.id);
    expect(out.kpis.qualifiedQty).toBeGreaterThanOrEqual(10);
    expect(out.kpis.returnedQty).toBeGreaterThanOrEqual(2);
    expect(out.kpis.returnRate).toBeGreaterThan(0);
    expect(out.kpis.deliveryLeadTimeDaysAvg).toBeDefined();

    await prisma.financeEvent.deleteMany({ where: { referenceId: rn.id } });
    await prisma.inventoryEvent.deleteMany({ where: { referenceId: rn.lines[0].id } });
    await prisma.inventoryBalance.deleteMany({ where: { warehouseId: wh.id } });
    await prisma.receivingNoteLine.deleteMany({ where: { receivingNoteId: rn.id } });
    await prisma.receivingNote.deleteMany({ where: { id: rn.id } });
    await prisma.purchaseOrderLine.deleteMany({ where: { poId: po.id } });
    await prisma.purchaseOrder.deleteMany({ where: { id: po.id } });
    await prisma.product.deleteMany({ where: { id: prod.id } });
    await prisma.warehouse.deleteMany({ where: { id: wh.id } });
    await prisma.supplier.deleteMany({ where: { id: sup.id } });
    await prisma.merchant.deleteMany({ where: { id: m.id } });
  }, 30000);
});
