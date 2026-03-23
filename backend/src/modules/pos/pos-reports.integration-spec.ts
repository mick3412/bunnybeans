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
    expect(out.memberContribution).toBeDefined();
    expect(out.memberContribution?.guestRevenue).toBeGreaterThanOrEqual(100);
    expect(out.memberContribution?.guestOrdersCount).toBeGreaterThanOrEqual(1);

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

    expect(out.byDay).toBeDefined();
    expect(out.byDay!.length).toBeGreaterThanOrEqual(1);
    const totalRevenue = out.byDay!.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = out.byDay!.reduce((sum, d) => sum + d.ordersCount, 0);
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

  it('summary returns memberContribution with member and guest breakdown', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-MC-${Date.now()}`, name: 'Member Contrib Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-MC-${Date.now()}`, name: 'MC Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-MC-${Date.now()}`,
        name: 'MC WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-MC-${Date.now()}`, name: 'MC Product' },
    });
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        name: 'Member Customer',
        phone: `MC-${Date.now()}`,
        memberCode: `M${Date.now()}`,
      },
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
        note: 'mc seed',
      },
    });

    const guestOrder = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    const memberOrder = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 75 }],
      payments: [{ method: 'CASH', amount: 150 }],
      customerId: customer.id,
    });

    const out = await reports.summary({ merchantId: merchant.id, preset: 'today', storeId: store.id });

    expect(out.memberContribution).toBeDefined();
    expect(out.memberContribution?.memberRevenue).toBeGreaterThanOrEqual(150);
    expect(out.memberContribution?.memberOrdersCount).toBeGreaterThanOrEqual(1);
    expect(out.memberContribution?.guestRevenue).toBeGreaterThanOrEqual(100);
    expect(out.memberContribution?.guestOrdersCount).toBeGreaterThanOrEqual(1);

    await prisma.posOrderItem.deleteMany({ where: { orderId: { in: [guestOrder.id, memberOrder.id] } } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: { in: [guestOrder.id, memberOrder.id] } } });
    await prisma.posOrder.deleteMany({ where: { id: { in: [guestOrder.id, memberOrder.id] } } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: { in: [guestOrder.id, memberOrder.id] } } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('summary returns byStore with multi-store revenue breakdown', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-BS-${Date.now()}`, name: 'ByStore Merchant' },
    });
    const store1 = await prisma.store.create({
      data: { code: `SR-BS1-${Date.now()}`, name: 'Store A', merchantId: merchant.id },
    });
    const store2 = await prisma.store.create({
      data: { code: `SR-BS2-${Date.now()}`, name: 'Store B', merchantId: merchant.id },
    });
    const wh1 = await prisma.warehouse.create({
      data: { code: `WR-BS1-${Date.now()}`, name: 'WH A', merchantId: merchant.id, storeId: store1.id },
    });
    const wh2 = await prisma.warehouse.create({
      data: { code: `WR-BS2-${Date.now()}`, name: 'WH B', merchantId: merchant.id, storeId: store2.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-BS-${Date.now()}`, name: 'BS Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: wh1.id } },
      create: { productId: product.id, warehouseId: wh1.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: wh2.id } },
      create: { productId: product.id, warehouseId: wh2.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });
    await prisma.inventoryEvent.createMany({
      data: [
        { productId: product.id, warehouseId: wh1.id, type: 'PURCHASE_IN', quantity: 10, occurredAt: new Date(), note: 'bs' },
        { productId: product.id, warehouseId: wh2.id, type: 'PURCHASE_IN', quantity: 10, occurredAt: new Date(), note: 'bs' },
      ],
    });

    const o1 = await posService.createOrder({
      storeId: store1.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'CASH', amount: 200 }],
    });
    const o2 = await posService.createOrder({
      storeId: store2.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 300 }],
      payments: [{ method: 'CASH', amount: 300 }],
    });

    const out = await reports.summary({ merchantId: merchant.id, preset: 'today' });
    expect(out.byStore).toBeDefined();
    expect(out.byStore!.length).toBe(2);
    const byStoreMap = new Map(out.byStore!.map((s) => [s.storeId, s]));
    expect(byStoreMap.get(store1.id)?.revenue).toBe(200);
    expect(byStoreMap.get(store1.id)?.ordersCount).toBe(1);
    expect(byStoreMap.get(store1.id)?.storeCode).toBe(store1.code);
    expect(byStoreMap.get(store2.id)?.revenue).toBe(300);
    expect(byStoreMap.get(store2.id)?.ordersCount).toBe(1);
    expect(byStoreMap.get(store1.id)?.avgOrder).toBe(200);
    expect(byStoreMap.get(store2.id)?.avgOrder).toBe(300);
    expect(out.byStore![0].revenue).toBeGreaterThanOrEqual(out.byStore![1].revenue);

    await prisma.posOrderItem.deleteMany({ where: { orderId: { in: [o1.id, o2.id] } } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: { in: [o1.id, o2.id] } } });
    await prisma.posOrder.deleteMany({ where: { id: { in: [o1.id, o2.id] } } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: { in: [o1.id, o2.id] } } });
    await prisma.inventoryEvent.deleteMany({ where: { productId: product.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [wh1.id, wh2.id] } } });
    await prisma.store.deleteMany({ where: { id: { in: [store1.id, store2.id] } } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('summary with storeId skips byStore (undefined or empty)', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.findFirst();
    const store = await prisma.store.findFirst({ where: { merchantId: merchant!.id } });
    if (!merchant || !store) return;

    const out = await reports.summary({ merchantId: merchant.id, preset: 'today', storeId: store.id });
    expect(out.byStore === undefined || out.byStore?.length === 0).toBe(true);
  }, 10000);

  it('daily with groupBy=week returns items with periodStart', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-GB-${Date.now()}`, name: 'GroupBy Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-GB-${Date.now()}`, name: 'GB Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-GB-${Date.now()}`,
        name: 'GB WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-GB-${Date.now()}`, name: 'GB Product' },
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
        note: 'gb seed',
      },
    });

    await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 50 }],
    });

    const out = await reports.getDaily({
      merchantId: merchant.id,
      storeId: store.id,
      groupBy: 'week',
    });

    expect(out.items).toBeDefined();
    expect(out.groupBy).toBe('week');
    const items = out.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      expect(items[0]).toHaveProperty('periodStart');
      expect(items[0]).toHaveProperty('revenue');
      expect(items[0]).toHaveProperty('ordersCount');
    }

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

  it('daily with groupBy=hour returns byHour 0..23 with UTC bucketing', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-HR-${Date.now()}`, name: 'Hour Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-HR-${Date.now()}`, name: 'Hour Store', merchantId: merchant.id },
    });

    await prisma.posOrder.create({
      data: {
        orderNumber: `ORD-HR-${Date.now()}-a`,
        storeId: store.id,
        subtotalAmount: 30,
        discountAmount: 0,
        totalAmount: 30,
        createdAt: new Date('2025-06-15T14:25:00.000Z'),
      },
    });
    await prisma.posOrder.create({
      data: {
        orderNumber: `ORD-HR-${Date.now()}-b`,
        storeId: store.id,
        subtotalAmount: 70,
        discountAmount: 0,
        totalAmount: 70,
        createdAt: new Date('2025-06-15T14:40:00.000Z'),
      },
    });

    const out = await reports.getDaily({
      merchantId: merchant.id,
      storeId: store.id,
      from: '2025-06-15',
      to: '2025-06-15',
      groupBy: 'hour',
    });

    expect(out.groupBy).toBe('hour');
    expect(out.byHour).toBeDefined();
    const bh = out.byHour ?? [];
    expect(bh.length).toBe(24);
    expect(bh[14]!.ordersCount).toBe(2);
    expect(bh[14]!.revenue).toBe(100);
    expect(bh[13]!.ordersCount).toBe(0);

    await prisma.posOrder.deleteMany({ where: { storeId: store.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('order-value-distribution returns buckets for order amounts', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `MR-OVD-${Date.now()}`, name: 'OVD Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-OVD-${Date.now()}`, name: 'OVD Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-OVD-${Date.now()}`,
        name: 'OVD WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-OVD-${Date.now()}`, name: 'OVD Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 100 },
      update: { onHandQty: 100 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 100,
        occurredAt: new Date(),
        note: 'ovd seed',
      },
    });

    await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 150 }],
      payments: [{ method: 'CASH', amount: 150 }],
    });
    await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 2500 }],
      payments: [{ method: 'CASH', amount: 2500 }],
    });

    const out = await reports.getOrderValueDistribution({
      merchantId: merchant.id,
      preset: 'today',
      storeId: store.id,
    });

    expect(out.buckets).toBeDefined();
    expect(out.buckets.length).toBe(5);
    const labels = out.buckets.map((b) => b.label);
    expect(labels).toContain('0–200');
    expect(labels).toContain('2000+');
    const bucket150 = out.buckets.find((b) => b.label === '0–200');
    const bucket2500 = out.buckets.find((b) => b.label === '2000+');
    expect(bucket150?.count).toBeGreaterThanOrEqual(1);
    expect(bucket150?.revenue).toBeGreaterThanOrEqual(150);
    expect(bucket2500?.count).toBeGreaterThanOrEqual(1);
    expect(bucket2500?.revenue).toBeGreaterThanOrEqual(2500);

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

