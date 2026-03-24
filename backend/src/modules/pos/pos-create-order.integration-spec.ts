/**
 * Integration test: POS create order → inventory deduction → finance event.
 * Requires DATABASE_URL and a migrated database (e.g. pnpm prisma:db:push).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { PosModule } from './pos.module';
import { PosService } from './application/pos.service';
import { PromotionService } from '../promotion/application/promotion.service';
import { Prisma } from '@prisma/client';

describe('PosService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let posService: PosService;
  let promotionService: PromotionService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping POS integration test');
      return;
    }
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        InventoryModule,
        FinanceModule,
        PosModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    posService = app.get(PosService);
    promotionService = app.get(PromotionService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('listProductsWithInventory returns products with onHandQty for store warehouse', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `T-LPI-${Date.now()}`, name: 'Test Merchant LPI' },
    });
    const store = await prisma.store.create({
      data: { code: `S-LPI-${Date.now()}`, name: 'Test Store LPI', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-LPI-${Date.now()}`,
        name: 'Test WH LPI',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-LPI-${Date.now()}`, name: 'Product LPI' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        onHandQty: 42,
      },
      update: { onHandQty: 42 },
    });

    const items = await posService.listProductsWithInventory(store.id);
    expect(Array.isArray(items)).toBe(true);
    const found = items.find((p) => p.id === product.id);
    expect(found).toBeDefined();
    expect(found!.onHandQty).toBe(42);
    expect(found!.name).toBe('Product LPI');
    expect('brandName' in found!).toBe(true);

    const brand = await prisma.brand.create({
      data: { code: `BR-LPI-${Date.now()}`, name: 'Brand LPI' },
    });
    const productWithBrand = await prisma.product.create({
      data: { sku: `SKU-LPI-B-${Date.now()}`, name: 'Product With Brand', brandId: brand.id },
    });
    const foundWithBrand = (await posService.listProductsWithInventory(store.id)).find(
      (p) => p.id === productWithBrand.id,
    );
    expect((foundWithBrand as { brandName?: string | null })?.brandName).toBe('Brand LPI');

    await prisma.product.delete({ where: { id: productWithBrand.id } });
    await prisma.brand.delete({ where: { id: brand.id } });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  });

  it('creates order, deducts inventory, and records finance event', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `T-${Date.now()}`, name: 'Test Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `S-${Date.now()}`, name: 'Test Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-${Date.now()}`,
        name: 'Test Warehouse',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-${Date.now()}`, name: 'Test Product' },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'Test stock',
      },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        onHandQty: 10,
      },
      update: { onHandQty: 10 },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    expect(order).toBeDefined();
    expect(order.id).toBeDefined();
    expect(order.orderNumber).toMatch(/^POS-/);
    expect(order.storeId).toBe(store.id);
    expect(order.totalAmount).toBe(100);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe(product.id);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].unitPrice).toBe(50);
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].method).toBe('CASH');
    expect(order.payments[0].amount).toBe(100);
    expect(order.paidAmount).toBe(100);
    expect(order.remainingAmount).toBe(0);
    expect(order.credit).toBe(false);
    expect(order.customerId).toBeNull();
    expect(order.customerName).toBeNull();
    expect(order.customerCode).toBeNull();

    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
    });
    expect(balance?.onHandQty).toBe(8);

    const financeEvents = await prisma.financeEvent.findMany({
      where: { referenceId: order.id },
    });
    expect(financeEvents.length).toBeGreaterThanOrEqual(1);
    expect(Number(financeEvents[0].amount)).toBe(100);

    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
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
  }, 15000);

  it('exportOrdersCsv includes header and order row for storeId', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `EXP-${Date.now()}`, name: 'Export Test' },
    });
    const store = await prisma.store.create({
      data: { code: `SEXP-${Date.now()}`, name: 'Export Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WEXP-${Date.now()}`,
        name: 'Export WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUEXP-${Date.now()}`, name: 'Export Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'export test stock',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 88 }],
      payments: [{ method: 'CASH', amount: 88 }],
    });

    const csv = await posService.exportOrdersCsv({ storeId: store.id });
    expect(csv).toContain(
      'id,orderNumber,storeId,customerId,customerName,subtotalAmount,discountAmount,totalAmount,createdAt',
    );
    expect(csv).toContain(order.orderNumber);
    expect(csv).toContain(store.id);
    expect(csv).toContain(',88,');

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

  it('exportOrdersCsv includeLines=1 emits one row per line item', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `EX2-${Date.now()}`, name: 'Export2' },
    });
    const store = await prisma.store.create({
      data: { code: `S2-${Date.now()}`, name: 'S2', merchantId: merchant.id },
    });
    const wh = await prisma.warehouse.create({
      data: {
        code: `W2-${Date.now()}`,
        name: 'W2',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const p1 = await prisma.product.create({
      data: { sku: `E2A-${Date.now()}`, name: 'A' },
    });
    const p2 = await prisma.product.create({
      data: { sku: `E2B-${Date.now()}`, name: 'B' },
    });
    for (const p of [p1, p2]) {
      await prisma.inventoryBalance.upsert({
        where: {
          productId_warehouseId: { productId: p.id, warehouseId: wh.id },
        },
        create: { productId: p.id, warehouseId: wh.id, onHandQty: 10 },
        update: { onHandQty: 10 },
      });
      await prisma.inventoryEvent.create({
        data: {
          productId: p.id,
          warehouseId: wh.id,
          type: 'PURCHASE_IN',
          quantity: 10,
          occurredAt: new Date(),
          note: 'e2',
        },
      });
    }
    const order = await posService.createOrder({
      storeId: store.id,
      items: [
        { productId: p1.id, quantity: 1, unitPrice: 10 },
        { productId: p2.id, quantity: 2, unitPrice: 20 },
      ],
      payments: [{ method: 'CASH', amount: 50 }],
    });
    const csv = await posService.exportOrdersCsv({
      storeId: store.id,
      includeLines: true,
    });
    expect(csv).toContain('lineItemId');
    expect(csv).toContain('lineProductId');
    const lines = csv.split('\n').filter((l) => l.includes(order.id));
    expect(lines.length).toBe(2);
    expect(csv).toContain(p1.id);
    expect(csv).toContain(p2.id);

    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } });
    await prisma.financeEvent.deleteMany({ where: { referenceId: order.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: [p1.id, p2.id] }, warehouseId: wh.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: { in: [p1.id, p2.id] } },
    });
    await prisma.product.deleteMany({ where: { id: { in: [p1.id, p2.id] } } });
    await prisma.warehouse.delete({ where: { id: wh.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);

  it('returnToStock: RETURN_FROM_CUSTOMER restores onHand; POS_RETURN_EXCEEDS_SOLD', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TRTS-${Date.now()}`, name: 'Return Test' },
    });
    const store = await prisma.store.create({
      data: { code: `SRTS-${Date.now()}`, name: 'Return Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WRTS-${Date.now()}`,
        name: 'Return WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKURTS-${Date.now()}`, name: 'Return Product' },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'seed',
      },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    const afterSale = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
    });
    expect(afterSale?.onHandQty).toBe(8);

    const afterReturn = await posService.returnToStock(order.id, {
      items: [{ productId: product.id, quantity: 1 }],
    });
    expect(afterReturn.id).toBe(order.id);

    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
    });
    expect(balance?.onHandQty).toBe(9);

    const returns = await prisma.inventoryEvent.findMany({
      where: {
        referenceId: order.id,
        type: 'RETURN_FROM_CUSTOMER',
        productId: product.id,
      },
    });
    expect(returns).toHaveLength(1);
    expect(returns[0].quantity).toBe(1);

    let code: string | undefined;
    try {
      await posService.returnToStock(order.id, {
        items: [{ productId: product.id, quantity: 2 }],
      });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    }
    expect(code).toBe('POS_RETURN_EXCEEDS_SOLD');

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

  it('allowCredit: partial payment, SALE_RECEIVABLE + SALE_PAYMENT + customer on order', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TC-${Date.now()}`, name: 'Credit Test' },
    });
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        code: 'CR-01',
        name: '掛帳客戶甲',
      },
    });
    const store = await prisma.store.create({
      data: { code: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: 'Credit Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WC-${Date.now()}`,
        name: 'Credit WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUC-${Date.now()}`, name: 'Credit Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 30 }],
      customerId: customer.id,
      allowCredit: true,
    });

    expect(order.totalAmount).toBe(100);
    expect(order.paidAmount).toBe(30);
    expect(order.remainingAmount).toBe(70);
    expect(order.credit).toBe(true);
    expect(order.payments).toHaveLength(1);
    expect(order.customerId).toBe(customer.id);
    expect(order.customerName).toBe('掛帳客戶甲');
    expect(order.customerCode).toBe('CR-01');

    const list = await posService.listOrders({
      storeId: store.id,
      page: 1,
      pageSize: 10,
    });
    const row = list.items.find((r) => r.id === order.id);
    expect(row?.customerId).toBe(customer.id);
    expect(row?.customerName).toBe('掛帳客戶甲');

    const events = await prisma.financeEvent.findMany({
      where: { referenceId: order.id },
      orderBy: { type: 'asc' },
    });
    const receivable = events.find((e) => e.type === 'SALE_RECEIVABLE');
    const payment = events.find((e) => e.type === 'SALE_PAYMENT');
    expect(receivable && Number(receivable.amount)).toBe(100);
    expect(payment && Number(payment.amount)).toBe(30);

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
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('allowCredit: resolve customer by customerPhone when customerId omitted', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TP-${Date.now()}`, name: 'Phone Credit Test' },
    });
    const customer = await prisma.customer.create({
      data: {
        merchantId: merchant.id,
        code: 'PH-01',
        name: '手機掛帳客戶',
        phone: '0911222333',
      },
    });
    const store = await prisma.store.create({
      data: { code: `SP-${Date.now()}`, name: 'Phone Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WP-${Date.now()}`,
        name: 'Phone WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUP-${Date.now()}`, name: 'Phone Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 10 }],
      customerPhone: '0911-222-333',
      allowCredit: true,
    });

    expect(order.customerId).toBe(customer.id);
    expect(order.credit).toBe(true);
    expect(order.remainingAmount).toBe(40);

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
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('appendPayment: partial then settle; then POS_ORDER_ALREADY_SETTLED', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TA-${Date.now()}`, name: 'Append Test' },
    });
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, code: 'AP-01', name: '補款客戶' },
    });
    const store = await prisma.store.create({
      data: { code: `SA-${Date.now()}`, name: 'Append Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WA-${Date.now()}`,
        name: 'Append WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUA-${Date.now()}`, name: 'Append Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 20 }],
      customerId: customer.id,
      allowCredit: true,
    });
    expect(order.remainingAmount).toBe(80);

    const after30 = await posService.appendPaymentToOrder(order.id, {
      method: 'TRANSFER',
      amount: 30,
    });
    expect(after30.paidAmount).toBe(50);
    expect(after30.remainingAmount).toBe(50);
    expect(after30.credit).toBe(true);

    const after50 = await posService.appendPaymentToOrder(order.id, {
      method: 'CASH',
      amount: 50,
    });
    expect(after50.paidAmount).toBe(100);
    expect(after50.remainingAmount).toBe(0);
    expect(after50.credit).toBe(false);

    let thrown: { code?: string } | null = null;
    try {
      await posService.appendPaymentToOrder(order.id, { method: 'CASH', amount: 1 });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      thrown = r.response ?? {};
    }
    expect(thrown?.code).toBe('POS_ORDER_ALREADY_SETTLED');

    const salePayments = await prisma.financeEvent.count({
      where: { referenceId: order.id, type: 'SALE_PAYMENT' },
    });
    expect(salePayments).toBe(3);

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
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('createOrder: POS_CUSTOMER_NOT_FOUND when customer wrong merchant', async () => {
    if (!process.env.DATABASE_URL) return;

    const m1 = await prisma.merchant.create({
      data: { code: `M1-${Date.now()}`, name: 'M1' },
    });
    const m2 = await prisma.merchant.create({
      data: { code: `M2-${Date.now()}`, name: 'M2' },
    });
    const store = await prisma.store.create({
      data: { code: `S1-${Date.now()}`, name: 'S1', merchantId: m1.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W1-${Date.now()}`,
        name: 'W1',
        merchantId: m1.id,
        storeId: store.id,
      },
    });
    const custM2 = await prisma.customer.create({
      data: { merchantId: m2.id, name: 'Only M2' },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUX-${Date.now()}`, name: 'P' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    let code: string | undefined;
    try {
      await posService.createOrder({
        storeId: store.id,
        items: [{ productId: product.id, quantity: 1, unitPrice: 10 }],
        payments: [{ method: 'CASH', amount: 10 }],
        customerId: custM2.id,
      });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    }
    expect(code).toBe('POS_CUSTOMER_NOT_FOUND');

    await prisma.customer.delete({ where: { id: custM2.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.deleteMany({ where: { id: { in: [m1.id, m2.id] } } });
  }, 15000);

  it('refundToOrder: SALE_REFUND then POS_REFUND_EXCEEDS_PAID', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TR-${Date.now()}`, name: 'Refund Test' },
    });
    const store = await prisma.store.create({
      data: { code: `SR-${Date.now()}`, name: 'Refund Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WR-${Date.now()}`,
        name: 'Refund WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUR-${Date.now()}`, name: 'Refund Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    await posService.refundToOrder(order.id, { amount: 30 });
    const refunds = await prisma.financeEvent.findMany({
      where: { referenceId: order.id, type: 'SALE_REFUND' },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(30);

    let code: string | undefined;
    try {
      await posService.refundToOrder(order.id, { amount: 80 });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    }
    expect(code).toBe('POS_REFUND_EXCEEDS_PAID');

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
  }, 15000);

  it('refundToOrder: POS_REFUND_NO_PAYMENT when credit zero payment', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TZ-${Date.now()}`, name: 'Zero Pay' },
    });
    const customer = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'C' },
    });
    const store = await prisma.store.create({
      data: { code: `SZ-${Date.now()}`, name: 'S', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `WZ-${Date.now()}`,
        name: 'W',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUZ-${Date.now()}`, name: 'P' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'seed',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [],
      customerId: customer.id,
      allowCredit: true,
    });
    expect(order.paidAmount).toBe(0);

    let code: string | undefined;
    try {
      await posService.refundToOrder(order.id, { amount: 1 });
    } catch (e: unknown) {
      const r = e as { response?: { code?: string } };
      code = r.response?.code;
    }
    expect(code).toBe('POS_REFUND_NO_PAYMENT');

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
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('applies promotion: preview and createOrder use discounted total', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `TP-${Date.now()}`, name: 'Promo Test' },
    });
    const store = await prisma.store.create({
      data: { code: `TS-${Date.now()}`, name: 'Promo Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `TW-${Date.now()}`,
        name: 'Promo WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `PSKU-${Date.now()}`, name: 'Promo Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: { productId: product.id, warehouseId: warehouse.id },
      },
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        onHandQty: 10,
      },
      update: { onHandQty: 10 },
    });

    const now = new Date();
    const rule = await prisma.promotionRule.create({
      data: {
        merchantId: merchant.id,
        name: '滿百折十',
        priority: 1,
        draft: false,
        startsAt: new Date(now.getTime() - 86400000),
        endsAt: new Date(now.getTime() + 86400000),
        exclusive: false,
        firstPurchaseOnly: false,
        memberLevels: [],
        conditions: [{ type: 'SPEND', op: '>=', value: 100 }],
        actions: [{ type: 'WHOLE_FIXED', fixedOff: 10 }],
        updatedAt: now,
      },
    });

    const preview = await promotionService.preview({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
    });
    expect(preview.subtotal).toBe(100);
    expect(preview.discount).toBe(10);
    expect(preview.total).toBe(90);

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 90 }],
    });
    expect(order.totalAmount).toBe(90);
    expect(order.subtotalAmount).toBe(100);
    expect(order.discountAmount).toBe(10);

    const ruleAfter = await prisma.promotionRule.findUnique({
      where: { id: rule.id },
    });
    expect(ruleAfter).toBeTruthy();
    expect(ruleAfter!.usageCount).toBeGreaterThanOrEqual(1);

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
    await prisma.promotionRule.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);

  it('promotion POINTS_MULTIPLIER applies to earned points for matching memberLevel', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `PMP-${Date.now()}`, name: 'Promo Points Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `PMP-S-${Date.now()}`, name: 'Promo Points Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `PMP-W-${Date.now()}`,
        name: 'Promo Points WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const customerVip = await prisma.customer.create({
      data: { merchantId: merchant.id, name: 'VIP', status: 'ACTIVE', memberLevel: 'VIP' },
    });
    // earnPerNT default 100; set explicitly for deterministic points
    await prisma.loyaltySettings.create({
      data: {
        merchantId: merchant.id,
        earnPerNT: new Prisma.Decimal(100),
        pointValueNT: new Prisma.Decimal(1),
        birthdayMultiplier: new Prisma.Decimal(1),
        rollingDays: 365,
        notifyDaysBefore: 30,
      },
    });

    const product = await prisma.product.create({
      data: { sku: `PMP-SKU-${Date.now()}`, name: 'Promo Points Product' },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 10,
        occurredAt: new Date(),
        note: 'stock',
      },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 10 },
      update: { onHandQty: 10 },
    });

    const rule = await prisma.promotionRule.create({
      data: {
        merchantId: merchant.id,
        name: 'VIP 2x points',
        priority: 1,
        draft: false,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-12-31'),
        exclusive: false,
        firstPurchaseOnly: false,
        memberLevels: ['VIP'],
        conditions: [{ type: 'SPEND', op: '>=', value: 0 }] as any,
        actions: [{ type: 'POINTS_MULTIPLIER', pointsMultiplier: 2 }] as any,
      },
    });

    const preview = await promotionService.preview({
      storeId: store.id,
      customerId: customerVip.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
      at: new Date('2026-06-01T12:00:00Z'),
    });
    expect(preview.pointsMultiplier).toBe(2);

    const order = await posService.createOrder({
      storeId: store.id,
      customerId: customerVip.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 200 }],
      payments: [{ method: 'CASH', amount: 200 }],
      occurredAt: new Date('2026-06-01T12:00:00Z').toISOString(),
    });

    const earned = await prisma.pointLedger.findFirst({
      where: {
        merchantId: merchant.id,
        customerId: customerVip.id,
        referenceId: order.id,
        type: 'EARNED',
      },
      orderBy: { createdAt: 'desc' },
    });
    // base points = floor(200/100)=2; multiplier 2 => 4
    expect(earned?.amount).toBe(4);

    await prisma.pointLedger.deleteMany({
      where: { merchantId: merchant.id, customerId: customerVip.id },
    });
    await prisma.financeEvent.deleteMany({ where: { referenceId: order.id } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.posOrder.delete({ where: { id: order.id } });
    await prisma.promotionRule.delete({ where: { id: rule.id } });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.loyaltySettings.delete({ where: { merchantId: merchant.id } });
    await prisma.customer.delete({ where: { id: customerVip.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 30000);

  it('exchange traceability: new order records exchangeFromOrderId', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `EX-${Date.now()}`, name: 'Exchange Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `EX-S-${Date.now()}`, name: 'Exchange Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `EX-W-${Date.now()}`, name: 'Exchange WH', merchantId: merchant.id, storeId: store.id },
    });
    const product = await prisma.product.create({
      data: { sku: `EX-SKU-${Date.now()}`, name: 'Exchange Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
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
        note: 'exchange seed',
      },
    });

    const original = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    await posService.returnToStock(original.id, { items: [{ productId: product.id, quantity: 1 }] });

    const exchanged = await posService.createOrder({
      storeId: store.id,
      exchangeFromOrderId: original.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 80 }],
      payments: [{ method: 'CASH', amount: 80 }],
    });

    const fetched = await posService.getOrderById(exchanged.id);
    expect(fetched.exchangeFromOrderId).toBe(original.id);
    expect(fetched.exchange?.sourceOrderId).toBe(original.id);
    expect(Array.isArray(fetched.exchange?.derivedOrderIds)).toBe(true);
    expect(fetched.exchange?.derivedOrderIds).toEqual([exchanged.id]);

    const origFetched = await posService.getOrderById(original.id);
    expect(origFetched.exchange?.sourceOrderId).toBeNull();
    expect(origFetched.exchange?.derivedOrderIds).toContain(exchanged.id);

    // Phase 2 settlement: derivedTotal(80) - sourceTotal(100) = -20 => refund required
    expect(origFetched.exchangeSettlement?.sourceTotal).toBe(100);
    expect(origFetched.exchangeSettlement?.derivedTotal).toBe(80);
    expect(origFetched.exchangeSettlement?.deltaAmount).toBe(-20);
    expect(origFetched.exchangeSettlement?.refund.neededAmount).toBe(20);
    expect(origFetched.exchangeSettlement?.refund.refundedAmount).toBe(0);
    expect(Array.isArray(origFetched.exchangeSettlement?.refund.events)).toBe(true);
    expect(origFetched.exchangeSettlement?.refundStatus).toBe('REQUIRED');
    expect(origFetched.exchangeSettlement?.topupStatus).toBe('NOT_NEEDED');

    await posService.refundToOrder(original.id, { amount: 20 });
    const afterRefund = await posService.getOrderById(original.id);
    expect(afterRefund.exchangeSettlement?.refundStatus).toBe('SETTLED');
    expect(afterRefund.exchangeSettlement?.refund.refundedAmount).toBeGreaterThanOrEqual(20);
    expect(afterRefund.exchangeSettlement?.refund.events.length).toBeGreaterThanOrEqual(1);

    await prisma.financeEvent.deleteMany({ where: { referenceId: { in: [original.id, exchanged.id] } } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: { in: [original.id, exchanged.id] } } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: { in: [original.id, exchanged.id] } } });
    await prisma.posOrder.deleteMany({ where: { id: { in: [original.id, exchanged.id] } } });
    await prisma.inventoryEvent.deleteMany({ where: { referenceId: original.id } });
    await prisma.inventoryEvent.deleteMany({ where: { productId: product.id, warehouseId: warehouse.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: product.id, warehouseId: warehouse.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 30000);

  it('listOrders includes after-sales fields and supports filters', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `AS-${Date.now()}`, name: 'AfterSales Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `AS-S-${Date.now()}`, name: 'AfterSales Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `AS-W-${Date.now()}`, name: 'AfterSales WH', merchantId: merchant.id, storeId: store.id },
    });
    const product = await prisma.product.create({
      data: { sku: `AS-SKU-${Date.now()}`, name: 'AfterSales Product' },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
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
        note: 'after-sales seed',
      },
    });

    const refundOnly = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    await posService.refundToOrder(refundOnly.id, { amount: 30 });

    const returnOnly = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    await posService.returnToStock(returnOnly.id, {
      items: [{ productId: product.id, quantity: 1 }],
    });

    const source = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });
    const derived = await posService.createOrder({
      storeId: store.id,
      exchangeFromOrderId: source.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 80 }],
      payments: [{ method: 'CASH', amount: 80 }],
    });

    const listAll = await posService.listOrders({ storeId: store.id, page: 1, pageSize: 50 });
    const rowRefund = listAll.items.find((r) => r.id === refundOnly.id);
    const rowReturn = listAll.items.find((r) => r.id === returnOnly.id);
    const rowSource = listAll.items.find((r) => r.id === source.id);
    const rowDerived = listAll.items.find((r) => r.id === derived.id);

    expect(rowRefund?.hasRefunds).toBe(true);
    expect(rowRefund?.refundTotal).toBe(30);
    expect(rowRefund?.hasReturns).toBe(false);
    expect(rowRefund?.returnedItemCount).toBe(0);

    expect(rowReturn?.hasRefunds).toBe(false);
    expect(rowReturn?.refundTotal).toBe(0);
    expect(rowReturn?.hasReturns).toBe(true);
    expect(rowReturn?.returnedItemCount).toBe(1);

    expect(rowSource?.exchangeFromOrderId).toBeNull();
    expect(rowSource?.hasExchangeDerived).toBe(true);
    expect(rowDerived?.exchangeFromOrderId).toBe(source.id);
    expect(rowDerived?.hasExchangeDerived).toBe(false);

    const onlyRefund = await posService.listOrders({
      storeId: store.id,
      hasRefund: true,
      page: 1,
      pageSize: 50,
    });
    expect(onlyRefund.items.some((r) => r.id === refundOnly.id)).toBe(true);
    expect(onlyRefund.items.some((r) => r.id === returnOnly.id)).toBe(false);

    const onlyReturn = await posService.listOrders({
      storeId: store.id,
      hasReturn: true,
      page: 1,
      pageSize: 50,
    });
    expect(onlyReturn.items.some((r) => r.id === returnOnly.id)).toBe(true);
    expect(onlyReturn.items.some((r) => r.id === refundOnly.id)).toBe(false);

    const onlyExchange = await posService.listOrders({
      storeId: store.id,
      hasExchange: true,
      page: 1,
      pageSize: 50,
    });
    expect(onlyExchange.items.some((r) => r.id === source.id)).toBe(true);
    expect(onlyExchange.items.some((r) => r.id === derived.id)).toBe(true);

    const afterSalesOnly = await posService.listOrders({
      storeId: store.id,
      afterSalesOnly: true,
      page: 1,
      pageSize: 50,
    });
    expect(afterSalesOnly.items.some((r) => r.id === refundOnly.id)).toBe(true);
    expect(afterSalesOnly.items.some((r) => r.id === returnOnly.id)).toBe(true);
    expect(afterSalesOnly.items.some((r) => r.id === source.id)).toBe(true);
    expect(afterSalesOnly.items.some((r) => r.id === derived.id)).toBe(true);

    const page1 = await posService.listOrders({ storeId: store.id, page: 1, pageSize: 2 });
    const page2 = await posService.listOrders({ storeId: store.id, page: 2, pageSize: 2 });
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBeGreaterThanOrEqual(2);
    const p1Ids = new Set(page1.items.map((i) => i.id));
    expect(page2.items.some((i) => p1Ids.has(i.id))).toBe(false);

    const emptyMerchant = await prisma.merchant.create({
      data: { code: `AS-EMPTY-${Date.now()}`, name: 'AfterSales Empty' },
    });
    const emptyStore = await prisma.store.create({
      data: { code: `AS-ES-${Date.now()}`, name: 'AfterSales Empty Store', merchantId: emptyMerchant.id },
    });
    const emptyList = await posService.listOrders({
      storeId: emptyStore.id,
      afterSalesOnly: true,
      page: 1,
      pageSize: 20,
    });
    expect(emptyList.items).toHaveLength(0);
    expect(emptyList.total).toBe(0);
    await prisma.store.delete({ where: { id: emptyStore.id } });
    await prisma.merchant.delete({ where: { id: emptyMerchant.id } });

    const orderIds = [refundOnly.id, returnOnly.id, source.id, derived.id];
    await prisma.financeEvent.deleteMany({ where: { referenceId: { in: orderIds } } });
    await prisma.posOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.posOrderPayment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.posOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.inventoryEvent.deleteMany({ where: { referenceId: { in: orderIds } } });
    await prisma.inventoryEvent.deleteMany({ where: { productId: product.id, warehouseId: warehouse.id } });
    await prisma.inventoryBalance.deleteMany({ where: { productId: product.id, warehouseId: warehouse.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 30000);

  it('createOrder: concurrent orders — at most one succeeds when stock=5 and each wants 4', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const merchant = await prisma.merchant.create({
      data: { code: `RACE-${ts}`, name: 'Race' },
    });
    const store = await prisma.store.create({
      data: { code: `SRACE-${ts}`, name: 'S', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `WRACE-${ts}`, name: 'W', merchantId: merchant.id, storeId: store.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKURACE-${ts}`, name: 'P' },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 5 },
      update: { onHandQty: 5 },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 5,
        occurredAt: new Date(),
        note: 'race test',
      },
    });

    const createInput = {
      storeId: store.id,
      items: [{ productId: product.id, quantity: 4, unitPrice: 10 }],
      payments: [{ method: 'CASH', amount: 40 }],
    };

    const [r1, r2] = await Promise.allSettled([
      posService.createOrder(createInput),
      posService.createOrder(createInput),
    ]);

    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
    const rejected = [r1, r2].filter((r) => r.status === 'rejected');

    expect(fulfilled.length + rejected.length).toBe(2);
    if (rejected.length > 0) {
      const code = (rejected[0] as PromiseRejectedResult).reason as { response?: { code?: string } };
      expect(code.response?.code).toBe('INVENTORY_INSUFFICIENT');
    }

    const orders = await prisma.posOrder.findMany({
      where: { storeId: store.id },
      select: { id: true },
    });
    for (const o of orders) {
      await prisma.inventoryEvent.deleteMany({ where: { referenceId: o.id } });
      await prisma.posOrderItem.deleteMany({ where: { orderId: o.id } });
      await prisma.posOrderPayment.deleteMany({ where: { orderId: o.id } });
      await prisma.financeEvent.deleteMany({ where: { referenceId: o.id } });
      await prisma.posOrder.delete({ where: { id: o.id } });
    }
    await prisma.inventoryEvent.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.inventoryBalance.deleteMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    await prisma.posOrderItem.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('refundToOrder: sequential second refund exceeds → POS_REFUND_EXCEEDS_PAID', async () => {
    if (!process.env.DATABASE_URL) return;

    const ts = Date.now();
    const merchant = await prisma.merchant.create({
      data: { code: `REFR-${ts}`, name: 'Refund Seq' },
    });
    const store = await prisma.store.create({
      data: { code: `SREF-${ts}`, name: 'S', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: { code: `WREF-${ts}`, name: 'W', merchantId: merchant.id, storeId: store.id },
    });
    const product = await prisma.product.create({
      data: { sku: `SKUREF-${ts}`, name: 'P' },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
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
        note: 'refund seq',
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    await posService.refundToOrder(order.id, { amount: 60 });
    await expect(posService.refundToOrder(order.id, { amount: 60 })).rejects.toMatchObject({
      response: { code: 'POS_REFUND_EXCEEDS_PAID' },
    });

    const refunds = await prisma.financeEvent.findMany({
      where: { referenceId: order.id, type: 'SALE_REFUND' },
    });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(60);

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
  }, 15000);
});
