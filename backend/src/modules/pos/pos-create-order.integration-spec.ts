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

describe('PosService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let posService: PosService;

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
  });

  afterAll(async () => {
    if (app) await app.close();
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
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('allowCredit: partial payment, SALE_RECEIVABLE + SALE_PAYMENT', async () => {
    if (!process.env.DATABASE_URL) return;

    const customerId = '11111111-1111-1111-1111-111111111111';
    const merchant = await prisma.merchant.create({
      data: { code: `TC-${Date.now()}`, name: 'Credit Test' },
    });
    const store = await prisma.store.create({
      data: { code: `SC-${Date.now()}`, name: 'Credit Store', merchantId: merchant.id },
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
      customerId,
      allowCredit: true,
    });

    expect(order.totalAmount).toBe(100);
    expect(order.paidAmount).toBe(30);
    expect(order.remainingAmount).toBe(70);
    expect(order.credit).toBe(true);
    expect(order.payments).toHaveLength(1);

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
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 15000);

  it('appendPayment: partial then settle; then POS_ORDER_ALREADY_SETTLED', async () => {
    if (!process.env.DATABASE_URL) return;

    const customerId = '22222222-2222-2222-2222-222222222222';
    const merchant = await prisma.merchant.create({
      data: { code: `TA-${Date.now()}`, name: 'Append Test' },
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
      customerId,
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
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 20000);
});
