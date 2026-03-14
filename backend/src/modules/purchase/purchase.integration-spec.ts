import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { PurchaseModule } from './purchase.module';
import { PurchaseOrderService } from './application/purchase-order.service';
import { ReceivingNoteService } from './application/receiving-note.service';

describe('Purchase receiving + PURCHASE_PAYABLE (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let poSvc: PurchaseOrderService;
  let rnSvc: ReceivingNoteService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, PurchaseModule],
    }).compile();
    prisma = app.get(PrismaService);
    poSvc = app.get(PurchaseOrderService);
    rnSvc = app.get(ReceivingNoteService);
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
        code: `W-${Date.now()}`,
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
        partyId: sup.id,
      },
    });
    expect(payable).toBeTruthy();
    expect(Number(payable!.amount)).toBeCloseTo(7 * 25.5, 2);

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
});
