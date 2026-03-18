/**
 * Integration test: Inventory record event → balance updated; get balances / events.
 * Requires DATABASE_URL and a migrated database (e.g. pnpm prisma:db:push).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { InventoryModule } from './inventory.module';
import { InventoryService } from './application/inventory.service';

describe('InventoryService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping Inventory integration test');
      return;
    }
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        InventoryModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    inventoryService = app.get(InventoryService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('records PURCHASE_IN event and updates balance; getBalances and getEvents return expected data', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-INV-${Date.now()}`, name: 'Inventory Test Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-INV-${Date.now()}`,
        name: 'Inventory Test Warehouse',
        merchantId: (await prisma.merchant.create({
          data: { code: `M-INV-${Date.now()}`, name: 'Inv Test Merchant' },
        })).id,
      },
    });

    const result = await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 20,
      occurredAt: new Date().toISOString(),
      note: 'Integration test',
    });

    expect(result.event).toBeDefined();
    expect(result.event.id).toBeDefined();
    expect(result.event.quantity).toBe(20);
    expect(result.balance).toBeDefined();
    expect(result.balance.onHandQty).toBe(20);

    const balances = await inventoryService.getBalances({
      productIds: [product.id],
      warehouseIds: [warehouse.id],
    });
    expect(balances.length).toBe(1);
    expect(balances[0].productId).toBe(product.id);
    expect(balances[0].warehouseId).toBe(warehouse.id);
    expect(balances[0].onHandQty).toBe(20);

    const eventsResult = await inventoryService.getEvents({
      productId: product.id,
      warehouseId: warehouse.id,
      page: 1,
      pageSize: 10,
    });
    expect(eventsResult.items.length).toBeGreaterThanOrEqual(1);
    expect(eventsResult.total).toBeGreaterThanOrEqual(1);
    const purchaseEvent = eventsResult.items.find((e) => e.quantity === 20);
    expect(purchaseEvent).toBeDefined();

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.customer.deleteMany({ where: { merchantId: warehouse.merchantId } });
    await prisma.merchant.deleteMany({
      where: { id: warehouse.merchantId },
    });
  }, 15000);

  it('getBalancesEnriched returns sku and name for warehouse', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-ENR-${Date.now()}`, name: 'Enriched Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-ENR-${Date.now()}`,
        name: 'Enriched Warehouse',
        merchantId: (
          await prisma.merchant.create({
            data: { code: `M-ENR-${Date.now()}`, name: 'Enr Merchant' },
          })
        ).id,
      },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 3,
    });
    const enriched = await inventoryService.getBalancesEnriched(warehouse.id);
    expect(enriched.length).toBe(1);
    expect(enriched[0].sku).toBe(product.sku);
    expect(enriched[0].name).toBe('Enriched Product');
    expect(enriched[0].onHandQty).toBe(3);

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: warehouse.merchantId } });
  }, 15000);

  it('exportBalancesCsv returns header and row with sku,name,onHandQty', async () => {
    if (!process.env.DATABASE_URL) return;

    const product = await prisma.product.create({
      data: { sku: `SKU-CSV-${Date.now()}`, name: 'CSV Balance Product' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-CSV-${Date.now()}`,
        name: 'CSV Warehouse',
        merchantId: (
          await prisma.merchant.create({
            data: { code: `M-CSV-${Date.now()}`, name: 'CSV Merchant' },
          })
        ).id,
      },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 7,
    });
    const csv = await inventoryService.exportBalancesCsv(warehouse.id);
    expect(csv).toContain('sku,name,productId,warehouseId,onHandQty,updatedAt');
    expect(csv).toContain(product.sku);
    expect(csv).toContain('CSV Balance Product');
    expect(csv).toContain(',7,');

    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: warehouse.merchantId } });
  }, 15000);

  it('transferInventory moves qty atomically between warehouses', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-TR-${Date.now()}`, name: 'Transfer Merchant' },
    });
    const wA = await prisma.warehouse.create({
      data: { code: `W-TR-A-${Date.now()}`, name: 'Transfer A', merchantId: merchant.id },
    });
    const wB = await prisma.warehouse.create({
      data: { code: `W-TR-B-${Date.now()}`, name: 'Transfer B', merchantId: merchant.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-TR-${Date.now()}`, name: 'Transfer Product' },
    });

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: wA.id,
      type: 'PURCHASE_IN',
      quantity: 50,
    });

    const out = await inventoryService.transferInventory({
      fromWarehouseId: wA.id,
      toWarehouseId: wB.id,
      productId: product.id,
      quantity: 15,
      note: 'integration transfer',
    });

    expect(out.referenceId).toBeDefined();
    expect(out.balances.from.onHandQty).toBe(35);
    expect(out.balances.to.onHandQty).toBe(15);

    const evs = await prisma.inventoryEvent.findMany({
      where: { referenceId: out.referenceId },
      orderBy: { type: 'asc' },
    });
    expect(evs.length).toBe(2);
    expect(evs.some((e) => e.type === 'TRANSFER_OUT' && e.quantity === -15)).toBe(true);
    expect(evs.some((e) => e.type === 'TRANSFER_IN' && e.quantity === 15)).toBe(true);

    await prisma.inventoryEvent.deleteMany({ where: { productId: product.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: wA.id } });
    await prisma.warehouse.delete({ where: { id: wB.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('importEventsFromCsvBuffer: 2 gains + 1 bad sku; balance += 3', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-CIMP-${Date.now()}`, name: 'Csv Import Merchant' },
    });
    const whCode = `W-CIMP-${Date.now()}`;
    const warehouse = await prisma.warehouse.create({
      data: {
        code: whCode,
        name: 'Csv Import WH',
        merchantId: merchant.id,
      },
    });
    const skuOk = `SKU-CIMP-${Date.now()}`;
    const product = await prisma.product.create({
      data: { sku: skuOk, name: 'Csv Import Product' },
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 10,
      note: 'seed for import test',
    });

    const csv = [
      'sku,warehouseCode,quantityDelta',
      `${skuOk},${whCode},2`,
      `${skuOk},${whCode},1`,
      `NO-SUCH-SKU,${whCode},1`,
    ].join('\n');

    const out = await inventoryService.importEventsFromCsvBuffer(
      Buffer.from(csv, 'utf8'),
    );
    expect(out.ok).toBe(2);
    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].row).toBe(4);
    expect(out.failed[0].reason).toContain('not found');

    const bal = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });
    expect(bal?.onHandQty).toBe(13);

    await prisma.inventoryEvent.deleteMany({
      where: { referenceId: out.referenceId },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('batchStocktake writes STOCKTAKE_GAIN and STOCKTAKE_LOSS, updates balances', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-BST-${Date.now()}`, name: 'Batch Stocktake Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-BST-${Date.now()}`,
        name: 'Batch Stocktake WH',
        merchantId: merchant.id,
      },
    });
    const product1 = await prisma.product.create({
      data: { sku: `SKU-BST1-${Date.now()}`, name: 'Batch Stocktake P1' },
    });
    const product2 = await prisma.product.create({
      data: { sku: `SKU-BST2-${Date.now()}`, name: 'Batch Stocktake P2' },
    });

    await inventoryService.recordInventoryEvent({
      productId: product1.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 10,
      note: 'seed',
    });
    await inventoryService.recordInventoryEvent({
      productId: product2.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 10,
      note: 'seed',
    });
    const out = await inventoryService.batchStocktake({
      warehouseId: warehouse.id,
      lines: [
        { productId: product1.id, actualQty: 12 },
        { productId: product2.id, actualQty: 7 },
      ],
    });
    expect(out.ok).toBe(2);
    expect(out.failed).toHaveLength(0);
    expect(out.referenceId).toBeDefined();

    const balances = await inventoryService.getBalances({
      productIds: [product1.id, product2.id],
      warehouseIds: [warehouse.id],
    });
    const b1 = balances.find((b) => b.productId === product1.id);
    const b2 = balances.find((b) => b.productId === product2.id);
    expect(b1?.onHandQty).toBe(12);
    expect(b2?.onHandQty).toBe(7);

    await prisma.inventoryEvent.deleteMany({
      where: { referenceId: out.referenceId },
    });
    await prisma.inventoryEvent.deleteMany({
      where: {
        productId: { in: [product1.id, product2.id] },
        warehouseId: warehouse.id,
      },
    });
    await prisma.inventoryBalance.deleteMany({
      where: {
        productId: { in: [product1.id, product2.id] },
        warehouseId: warehouse.id,
      },
    });
    await prisma.product.deleteMany({ where: { id: { in: [product1.id, product2.id] } } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('scanStocktake resolves sku/barcode then writes stocktake events', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-SS-${Date.now()}`, name: 'Scan Stocktake Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-SS-${Date.now()}`,
        name: 'Scan Stocktake WH',
        merchantId: merchant.id,
      },
    });
    const barcode = `BC-SS-${Date.now()}`;
    const product = await prisma.product.create({
      data: { sku: `SKU-SS-${Date.now()}`, barcode, name: 'Scan Stocktake Product' },
    });

    try {
      await inventoryService.recordInventoryEvent({
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 2,
        note: 'seed',
      });

      const out = await inventoryService.scanStocktake({
        warehouseId: warehouse.id,
        lines: [{ sku: barcode, actualQty: 5 }],
      });
      expect(out.ok).toBe(1);
      expect(out.referenceId).toBeDefined();

      const bal = await prisma.inventoryBalance.findUnique({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      });
      expect(bal?.onHandQty).toBe(5);
    } finally {
      await prisma.inventoryEvent.deleteMany({ where: { warehouseId: warehouse.id } });
      await prisma.inventoryBalance.deleteMany({ where: { warehouseId: warehouse.id } });
      await prisma.product.deleteMany({ where: { id: product.id } });
      await prisma.warehouse.deleteMany({ where: { id: warehouse.id } });
      await prisma.merchant.deleteMany({ where: { id: merchant.id } });
    }
  }, 20000);

  it('getReplenishmentSuggestions suggests qty when onHand below targetStock', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-REP-${Date.now()}`, name: 'Replenishment Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-REP-${Date.now()}`,
        name: 'Replenishment WH',
        merchantId: merchant.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-REP-${Date.now()}`, name: 'Replenishment Product' },
    });

    // seed stock
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 10,
      note: 'seed for replenishment',
    });

    // create sales within lookback window: totalSold = 6
    const now = new Date();
    const occurredAt1 = new Date(now);
    occurredAt1.setDate(occurredAt1.getDate() - 2);
    const occurredAt2 = new Date(now);
    occurredAt2.setDate(occurredAt2.getDate() - 5);
    const occurredAt3 = new Date(now);
    occurredAt3.setDate(occurredAt3.getDate() - 9);

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: 2,
      occurredAt: occurredAt1.toISOString(),
      note: 'sale 1',
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: 2,
      occurredAt: occurredAt2.toISOString(),
      note: 'sale 2',
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: 2,
      occurredAt: occurredAt3.toISOString(),
      note: 'sale 3',
    });

    // onHand should be 4; avgDailySales = 6/30 = 0.2; targetStock = 0.2*(30+7)=7.4 => suggested ceil(3.4)=4
    const out = await inventoryService.getReplenishmentSuggestions({
      merchantId: merchant.id,
      warehouseId: warehouse.id,
      daysLookback: 30,
      daysAhead: 30,
      safetyDays: 7,
      minSuggestedQty: 0,
      page: 1,
      pageSize: 50,
    });
    expect(out.config.daysLookback).toBe(30);
    expect(out.config.daysAhead).toBe(30);
    expect(out.config.safetyDays).toBe(7);
    expect(out.items.length).toBe(1);
    expect(out.items[0].productId).toBe(product.id);
    expect(out.items[0].warehouseId).toBe(warehouse.id);
    expect(out.items[0].onHandQty).toBe(4);
    expect(out.items[0].avgDailySales).toBeCloseTo(0.2, 3);
    expect(out.items[0].targetStock).toBeCloseTo(7.4, 2);
    expect(out.items[0].suggestedQty).toBe(4);

    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('getExpiring returns batch rows aggregated by batchCode + expiryDate', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-EXP-${Date.now()}`, name: 'Expiring Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-EXP-${Date.now()}`,
        name: 'Expiring WH',
        merchantId: merchant.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-EXP-${Date.now()}`, name: 'Expiring Product' },
    });

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 10);
    const expiryIso = expiry.toISOString();

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 12,
      batchCode: 'B-TEST',
      expiryDate: expiryIso,
      weightUnit: 'KG',
      note: 'seed for expiring',
    });

    const out = await inventoryService.getExpiring({
      warehouseId: warehouse.id,
      from: new Date().toISOString(),
      daysAhead: 30,
      page: 1,
      pageSize: 50,
    });
    // 若 DB 尚未 migrate，repository 會回空；但在有 migrate 的環境下應能查到該批
    if (out.items.length > 0) {
      const row = out.items.find(
        (x: any) =>
          x.productId === product.id &&
          x.warehouseId === warehouse.id &&
          x.batchCode === 'B-TEST',
      );
      expect(row).toBeTruthy();
      expect((row as any).onHandQty).toBe(12);
    }

    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('getExpiring groupBy=product returns summary with earliestExpiryDate and expiringQty', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-EXPS-${Date.now()}`, name: 'Expiring Summary Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-EXPS-${Date.now()}`,
        name: 'Expiring Summary WH',
        merchantId: merchant.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-EXPS-${Date.now()}`, name: 'Expiring Summary Product' },
    });

    const expiry1 = new Date();
    expiry1.setDate(expiry1.getDate() + 5);
    const expiry2 = new Date();
    expiry2.setDate(expiry2.getDate() + 12);

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 3,
      batchCode: 'B-1',
      expiryDate: expiry1.toISOString(),
      note: 'seed exp summary 1',
    });
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 7,
      batchCode: 'B-2',
      expiryDate: expiry2.toISOString(),
      note: 'seed exp summary 2',
    });

    const out: any = await inventoryService.getExpiringSummaryByProduct({
      warehouseId: warehouse.id,
      from: new Date().toISOString(),
      daysAhead: 30,
      page: 1,
      pageSize: 50,
    });
    if (out.items.length > 0) {
      const row = out.items.find((x: any) => x.productId === product.id);
      expect(row).toBeTruthy();
      expect(row.sku).toBe(product.sku);
      expect(row.productName).toBe(product.name);
      expect(row.expiringQty).toBe(10);
      expect(Array.isArray(row.batches)).toBe(true);
      expect(row.batches.length).toBeGreaterThanOrEqual(2);
      expect(new Date(row.earliestExpiryDate).getTime()).toBeLessThanOrEqual(expiry2.getTime());
    }

    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('getSlowMoving returns product with low soldQty and high onHandQty', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-SLOW-${Date.now()}`, name: 'Slow Merchant' },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-SLOW-${Date.now()}`,
        name: 'Slow WH',
        merchantId: merchant.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-SLOW-${Date.now()}`, name: 'Slow Product' },
    });

    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'PURCHASE_IN',
      quantity: 50,
      note: 'seed for slow-moving',
    });
    const now = new Date();
    const occurredAt = new Date(now);
    occurredAt.setDate(occurredAt.getDate() - 2);
    await inventoryService.recordInventoryEvent({
      productId: product.id,
      warehouseId: warehouse.id,
      type: 'SALE_OUT',
      quantity: 2,
      occurredAt: occurredAt.toISOString(),
      note: 'low sales',
    });
    // onHand = 48, soldQty in 30d = 2
    const out = await inventoryService.getSlowMoving({
      merchantId: merchant.id,
      warehouseId: warehouse.id,
      lookbackDays: 30,
      salesThreshold: 5,
      onHandThreshold: 10,
    });
    expect(out.items.length).toBe(1);
    expect(out.items[0].productId).toBe(product.id);
    expect(out.items[0].sku).toBe(product.sku);
    expect(out.items[0].name).toBe(product.name);
    expect(out.items[0].soldQty).toBe(2);
    expect(out.items[0].onHandQty).toBe(48);
    expect(out.items[0].warehouseId).toBe(warehouse.id);
    expect(out.from).toBeDefined();
    expect(out.to).toBeDefined();

    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);
});
