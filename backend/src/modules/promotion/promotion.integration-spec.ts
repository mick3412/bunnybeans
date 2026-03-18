/**
 * Integration test: promotion effectiveness endpoint.
 * Requires DATABASE_URL and migrated database.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { PromotionModule } from './promotion.module';
import { PromotionService } from './application/promotion.service';
import { PosService } from '../pos/application/pos.service';
import { PosModule } from '../pos/pos.module';

describe('PromotionService getEffectiveness (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let promotionService: PromotionService;
  let posService: PosService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping promotion effectiveness test');
      return;
    }
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        PromotionModule,
        PosModule,
      ],
    }).compile();

    prisma = app.get(PrismaService);
    promotionService = app.get(PromotionService);
    posService = app.get(PosService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns triggerCount and discountTotal when order applies promotion', async () => {
    if (!process.env.DATABASE_URL) return;

    const merchant = await prisma.merchant.create({
      data: { code: `M-EFF-${Date.now()}`, name: 'Effectiveness Merchant' },
    });
    const store = await prisma.store.create({
      data: { code: `S-EFF-${Date.now()}`, name: 'Effectiveness Store', merchantId: merchant.id },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `W-EFF-${Date.now()}`,
        name: 'Effectiveness WH',
        merchantId: merchant.id,
        storeId: store.id,
      },
    });
    const product = await prisma.product.create({
      data: { sku: `SKU-EFF-${Date.now()}`, name: 'Effectiveness Product' },
    });
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        type: 'PURCHASE_IN',
        quantity: 20,
        occurredAt: new Date(),
        note: 'stock',
      },
    });
    await prisma.inventoryBalance.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      create: { productId: product.id, warehouseId: warehouse.id, onHandQty: 20 },
      update: { onHandQty: 20 },
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
      },
    });

    const order = await posService.createOrder({
      storeId: store.id,
      items: [{ productId: product.id, quantity: 2, unitPrice: 50 }],
      payments: [{ method: 'CASH', amount: 90 }],
    });
    expect(order.totalAmount).toBe(90);
    expect(order.discountAmount).toBe(10);

    const out = await promotionService.getEffectiveness(merchant.id, { preset: 'last30d' });
    expect(out).toHaveProperty('from');
    expect(out).toHaveProperty('to');
    expect(out).toHaveProperty('period');
    expect(out.items.length).toBe(1);
    expect(out.items[0].ruleId).toBe(rule.id);
    expect(out.items[0].ruleName).toBe('滿百折十');
    expect(out.items[0].triggerCount).toBe(1);
    expect(out.items[0].discountTotal).toBe(10);
    expect(out.items[0].drivenRevenue).toBe(90);

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
    await prisma.promotionRule.delete({ where: { id: rule.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.customer.deleteMany({ where: { merchantId: merchant.id } });
    await prisma.merchant.delete({ where: { id: merchant.id } });
  }, 25000);
});

describe('PromotionService reorder (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let promotionService: PromotionService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, PromotionModule],
    }).compile();
    prisma = app.get(PrismaService);
    promotionService = app.get(PromotionService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('reorder guards: missing/duplicate/other-merchant ids throw', async () => {
    if (!process.env.DATABASE_URL) return;
    const m1 = await prisma.merchant.create({ data: { code: `M-RD1-${Date.now()}`, name: 'Reorder M1' } });
    const m2 = await prisma.merchant.create({ data: { code: `M-RD2-${Date.now()}`, name: 'Reorder M2' } });
    const r1 = await prisma.promotionRule.create({ data: { merchantId: m1.id, name: 'R1', priority: 1, draft: true, exclusive: false, firstPurchaseOnly: false, memberLevels: [], conditions: [], actions: [] } });
    const r2 = await prisma.promotionRule.create({ data: { merchantId: m1.id, name: 'R2', priority: 2, draft: true, exclusive: false, firstPurchaseOnly: false, memberLevels: [], conditions: [], actions: [] } });
    const other = await prisma.promotionRule.create({ data: { merchantId: m2.id, name: 'O', priority: 1, draft: true, exclusive: false, firstPurchaseOnly: false, memberLevels: [], conditions: [], actions: [] } });
    try {
      await expect(promotionService.reorder('', [r1.id])).rejects.toMatchObject({ response: { code: 'PROMOTION_BODY_INVALID' } });
      await expect(promotionService.reorder(m1.id, [])).rejects.toMatchObject({ response: { code: 'PROMOTION_REORDER_EMPTY' } });
      await expect(promotionService.reorder(m1.id, [r1.id, r1.id])).rejects.toMatchObject({ response: { code: 'PROMOTION_REORDER_DUPLICATE_IDS' } });
      await expect(promotionService.reorder(m1.id, [r1.id, other.id])).rejects.toMatchObject({ response: { code: 'PROMOTION_NOT_FOUND' } });
      await promotionService.reorder(m1.id, [r2.id, r1.id]);
      const rows = await prisma.promotionRule.findMany({ where: { merchantId: m1.id }, orderBy: { priority: 'asc' }, select: { id: true, priority: true } });
      expect(rows.map((x) => x.id)).toEqual([r2.id, r1.id]);
      expect(rows.map((x) => x.priority)).toEqual([1, 2]);
    } finally {
      await prisma.promotionRule.deleteMany({ where: { id: { in: [r1.id, r2.id, other.id] } } });
      await prisma.merchant.deleteMany({ where: { id: { in: [m1.id, m2.id] } } });
    }
  }, 20000);
});
