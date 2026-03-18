/**
 * Integration test: POS reports (summary / top-items / daily) and cross-check with Finance.
 * Requires DATABASE_URL and a migrated database (e.g. pnpm prisma:db:push).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { FinanceModule } from '../finance/finance.module';
import { PosModule } from './pos.module';
import { PosReportsService } from './application/pos-reports.service';
import { PosService } from './application/pos.service';
import { FinanceService } from '../finance/application/finance.service';

describe('PosReportsService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let reports: PosReportsService;
  let posService: PosService;
  let financeService: FinanceService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping POS reports integration test');
      return;
    }

    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        PosModule,
        FinanceModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    reports = app.get(PosReportsService);
    posService = app.get(PosService);
    financeService = app.get(FinanceService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('summary returns period and KPIs for preset today', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-${Date.now()}`, name: 'Report Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-${Date.now()}`, name: 'Report Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-${Date.now()}`,
        name: 'Report WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-R-${Date.now()}`, name: 'Report Product' },
    });

    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'seed for reports',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    const out = await reports.summary({ merchantId: merchant.id, preset: 'today', storeId: store.id });

    expect(out.period).toBeDefined();
    expect(out.period?.preset).toBe('today');
    expect(out.period?.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.period?.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.ordersCount).toBeGreaterThanOrEqual(1);
    expect(Number(out.totalRevenue)).toBeGreaterThanOrEqual(100);
    expect(Number(out.avgOrder)).toBeGreaterThan(0);
    expect(out.byPaymentMethod?.CASH).toBeGreaterThanOrEqual(100);

    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: order.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('summary returns totalCost grossMargin grossMarginRate when product has costPrice', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-GM-${Date.now()}`, name: 'GM Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-GM-${Date.now()}`, name: 'GM Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-GM-${Date.now()}`,
        name: 'GM WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-GM-${Date.now()}`, name: 'GM Product', costPrice: 30 },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'gm test',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    const out = await reports.summary({ merchantId: merchant.id, preset: 'today', storeId: store.id });
    expect(out.totalCost).toBeDefined();
    expect(out.grossMargin).toBeDefined();
    expect(out.grossMarginRate).toBeDefined();
    expect(Number(out.totalCost)).toBe(60);
    expect(Number(out.grossMargin)).toBe(40);
    expect(out.grossMarginRate).toBe(40);

    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: order.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('top-items returns ranked items and respects limit', async () => {
    if (!process.env.DATABASE_URL) return;
    // Avoid cross-test pollution: FinancePeriodClose can block order finance events.
    await prisma.financePeriodClose.deleteMany({});

    const merchant = await prisma.merchant.create({
      data: { code: `MR2-${Date.now()}`, name: 'Report Merchant 2' },
    });
    const store = await prisma.store.create({
      data: { code: `SR2-${Date.now()}`, name: 'Report Store 2', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR2-${Date.now()}`,
        name: 'Report WH 2',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const p1 = await prisma.product.create({
      data: { sku: `SKU-R2A-${Date.now()}`, name: 'Report A' },
    });
    const p2 = await prisma.product.create({
      data: { sku: `SKU-R2B-${Date.now()}`, name: 'Report B' },
    });

    for (const p of [p1, p2]) {
      await prisma.inventoryBalance.upsert({
        where: {
          productId_warehouseId: { productId: p.id, warehouseId: warehouse.id },
        },
        create: { productId: p.id, warehouseId: warehouse.id, onHandQty: 20 },
        update: { onHandQty: 20 },
      });
      await prisma.inventoryEvent.create({
        data: {
          productId: p.id,
          warehouseId: warehouse.id,
          type: 'PURCHASE_IN',
          quantity: 20,
          occurredAt: new Date(),
          note: 'seed top items',
        },
      });
    }

    await posService.createOrder({
      storeId: store.id,
      items: [
        { productId: p1.id, quantity: 1, unitPrice: 10 },
        { productId: p2.id, quantity: 3, unitPrice: 20 },
      ],
      payments: [{ method: 'CASH', amount: 70 }],
    });

    const out = await reports.getTopItems({
      merchantId: merchant.id,
      storeId: store.id,
      limit: 1,
      sortBy: 'quantity',
    });

    expect(out.items.length).toBe(1);
    expect(out.items[0].productId).toBe(p2.id);
    expect(out.items[0].quantity).toBe(3);
    expect(out.items[0].revenue).toBe(60);
    expect(out.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await prisma.posOrderItem.deleteMany({ where: { order: { storeId: store.id } } });
    await prisma.posOrderPayment.deleteMany({ where: { order: { storeId: store.id } } });
    await prisma.posOrder.deleteMany({ where: { storeId: store.id } });
    await prisma.financeEvent.deleteMany({ where: { partyId: merchant.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: [p1.id, p2.id] }, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: { in: [p1.id, p2.id] }, warehouseId: warehouse.id },
    });
    await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('daily returns per-day revenue and ordersCount', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR3-${Date.now()}`, name: 'Report Merchant 3' },
    });
    const store = await prisma.store.create({
      data: { code: `SR3-${Date.now()}`, name: 'Report Store 3', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR3-${Date.now()}`,
        name: 'Report WH 3',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-R3-${Date.now()}`, name: 'Report Product 3' },
    });

    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 20 },
      update: { onHandQty: 20 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 20,
        occurredAt: new Date(),
        note: 'seed daily',
      },
    });

    await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 40 }],
      payments: [{ method: 'CASH', amount: 40 }],
    });
    await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 30 }],
      payments: [{ method: 'CASH', amount: 60 }],
    });

    const out = await reports.getDaily({ merchantId: merchant.id, storeId: store.id });

    expect(out.byDay.length).toBeGreaterThanOrEqual(1);
    const totalRevenue = out.byDay.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = out.byDay.reduce((sum, d) => sum + d.ordersCount, 0);
    expect(totalRevenue).toBeGreaterThanOrEqual(100);
    expect(totalOrders).toBeGreaterThanOrEqual(2);
    expect(out.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await prisma.posOrderItem.deleteMany({ where: { order: { storeId: store.id } } });
    await prisma.posOrderPayment.deleteMany({ where: { order: { storeId: store.id } } });
    await prisma.posOrder.deleteMany({ where: { storeId: store.id } });
    await prisma.financeEvent.deleteMany({ where: { partyId: merchant.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('summary throws REPORT_INVALID_RANGE when from > to', async () => {
    if (!process.env.DATABASE_URL) return;
    let code: string | undefined;
    const merchant = await prisma.merchant.create({
      data: { code: `MR-RANGE-${Date.now()}`, name: 'Report Merchant Range' },
    });
    try {
      await reports.summary({ merchantId: merchant.id, from: '2026-03-20', to: '2026-03-10' });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    } finally {
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }
    expect(code).toBe('REPORT_INVALID_RANGE');
  });

  it('reports are isolated by merchantId/storeId (store mismatch throws)', async () => {
    if (!process.env.DATABASE_URL) return;

    const ma = await prisma.merchant.create({ data: { code: `MR-ISO-A-${Date.now()}`, name: 'Iso POS A' } });
    const mb = await prisma.merchant.create({ data: { code: `MR-ISO-B-${Date.now()}`, name: 'Iso POS B' } });
    const storeB = await prisma.store.create({ data: { code: `SR-ISO-B-${Date.now()}`, name: 'Store B', merchantId: mb.id } });
    try {
      let code: string | undefined;
      try {
        await reports.summary({ merchantId: ma.id, preset: 'today', storeId: storeB.id });
      } catch (e: unknown) {
        const r = e as { response?: { code?: string } };
        code = r.response?.code;
      }
      expect(code).toBe('POS_STORE_NOT_FOUND');
    } finally {
      await prisma.store.deleteMany({ where: { id: storeB.id } });
      await prisma.merchant.deleteMany({ where: { id: { in: [ma.id, mb.id] } } });
    }
  }, 15000);

  it('POS summary and Finance summary consistent for same period (cross-check)', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MC-${Date.now()}`, name: 'Cross-check Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SC-${Date.now()}`, name: 'Cross-check Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WC-${Date.now()}`,
        name: 'Cross-check WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: 'Cross-check Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'cross-check seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 75 }],
      payments: [{ method: 'CASH', amount: 150 }],
    });
    const posSummary = await reports.summary({ merchantId: merchant.id, preset: 'today', storeId: store.id });
    const financeSummary = (await financeService.getSummary({ preset: 'last30d', groupBy: 'type' })) as { byType: Record<string, number> };

    expect(Number(posSummary.totalRevenue)).toBeGreaterThanOrEqual(150);
    expect(posSummary.ordersCount).toBeGreaterThanOrEqual(1);
    const receivableSum = financeSummary.byType?.SALE_RECEIVABLE ?? 0;
    expect(receivableSum).toBeGreaterThanOrEqual(150);

    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: order.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);
});

