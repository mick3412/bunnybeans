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
});
