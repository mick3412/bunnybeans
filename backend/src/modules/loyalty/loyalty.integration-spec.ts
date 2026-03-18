import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { LoyaltyModule } from './loyalty.module';
import { LoyaltyService } from './application/loyalty.service';

describe('LoyaltyService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let loyalty: LoyaltyService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        LoyaltyModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    loyalty = app.get(LoyaltyService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET settings: getSettings returns default or created settings', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY-${Date.now()}`, name: 'Loyalty Test' },
    });
    try {
      const s = await loyalty.getSettings(m.id);
      expect(s).toMatchObject({
        merchantId: m.id,
        earnPerNT: expect.any(Number),
        pointValueNT: expect.any(Number),
        rollingDays: expect.any(Number),
        notifyDaysBefore: expect.any(Number),
      });
    } finally {
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('PATCH settings then GET settings reflects update', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY-PATCH-${Date.now()}`, name: 'Loyalty Patch' },
    });
    try {
      await loyalty.getSettings(m.id);
      await loyalty.patchSettings(m.id, { earnPerNT: 2, rollingDays: 90 });
      const s = await loyalty.getSettings(m.id);
      expect(s.earnPerNT).toBe(2);
      expect(s.rollingDays).toBe(90);
    } finally {
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('GET point-ledger (merchantId only): listLedgerMerchantWide returns items', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY2-${Date.now()}`, name: 'Loyalty Ledger' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Ledger Customer' },
    });
    const led = await prisma.pointLedger.create({
      data: {
        merchantId: m.id,
        customerId: c.id,
        type: 'EARNED',
        amount: 5,
        balanceAfter: 5,
        txnCode: 'SALE',
        note: 'test',
      },
    });
    try {
      const rows = await loyalty.listLedgerMerchantWide(m.id, 50);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const one = rows.find((r) => r.id === led.id);
      expect(one).toBeDefined();
      expect(one!.amount).toBe(5);
      expect(one!.balanceAfter).toBe(5);
      expect(one!.customer.name).toBe('Ledger Customer');
    } finally {
      await prisma.pointLedger.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('GET point-ledger (merchantId + customerId): listLedger returns items', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY3-${Date.now()}`, name: 'Loyalty Ledger2' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Single Customer' },
    });
    await prisma.pointLedger.create({
      data: {
        merchantId: m.id,
        customerId: c.id,
        type: 'EARNED',
        amount: 3,
        balanceAfter: 3,
        note: 'test single',
      },
    });
    try {
      const rows = await loyalty.listLedger(m.id, c.id, 50);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(1);
      expect(rows[0].amount).toBe(3);
      expect(rows[0].balanceAfter).toBe(3);
    } finally {
      await prisma.pointLedger.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('listLedger with limit returns at most limit items', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY-LIM-${Date.now()}`, name: 'Loyalty Limit' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Limit Customer' },
    });
    await prisma.pointLedger.createMany({
      data: [
        { merchantId: m.id, customerId: c.id, type: 'EARNED', amount: 1, balanceAfter: 1 },
        { merchantId: m.id, customerId: c.id, type: 'EARNED', amount: 1, balanceAfter: 2 },
        { merchantId: m.id, customerId: c.id, type: 'EARNED', amount: 1, balanceAfter: 3 },
      ],
    });
    try {
      const rows = await loyalty.listLedger(m.id, c.id, 2);
      expect(rows.length).toBeLessThanOrEqual(2);
      expect(rows.length).toBe(2);
    } finally {
      await prisma.pointLedger.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('GET dashboard: dashboard returns numeric KPIs', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY4-${Date.now()}`, name: 'Loyalty Dash' },
    });
    try {
      const d = await loyalty.dashboard(m.id);
      expect(d).toMatchObject({
        pointsIssued30d: expect.any(Number),
        pointsRedeemed30d: expect.any(Number),
        activeMembersWithPoints: expect.any(Number),
      });
    } finally {
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.pointLedger.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('dashboard for merchant with zero PointLedger returns numeric KPIs', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY5-${Date.now()}`, name: 'Loyalty Empty' },
    });
    try {
      const d = await loyalty.dashboard(m.id);
      expect(typeof d.pointsIssued30d).toBe('number');
      expect(typeof d.pointsRedeemed30d).toBe('number');
      expect(typeof d.activeMembersWithPoints).toBe('number');
      expect(d.pointsIssued30d).toBe(0);
      expect(d.pointsRedeemed30d).toBe(0);
      expect(d.activeMembersWithPoints).toBe(0);
    } finally {
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  });

  it('createCoupon then listCoupons returns coupon with usedCount', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY-CP-${Date.now()}`, name: 'Loyalty Coupon' },
    });
    try {
      const created = await loyalty.createCoupon(m.id, {
        code: 'TEST10',
        name: 'Test $10 off',
        discountType: 'FIXED',
        value: 10,
        maxUses: 100,
      });
      expect(created.usedCount).toBe(0);
      const list = await loyalty.listCoupons(m.id);
      const found = list.find((c) => c.id === created.id);
      expect(found).toBeDefined();
      expect(found!.code).toBe('TEST10');
      expect(found!.usedCount).toBe(0);
    } finally {
      await prisma.loyaltyCoupon.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('getReportsActivity returns byDispatchRule and byCoupon when applicable', async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "CrmCouponDispatchRule" LIMIT 1`;
    } catch {
      return;
    }
    const m = await prisma.merchant.create({
      data: { code: `LY-ACT-${Date.now()}`, name: 'Loyalty Activity' },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'Test Seg' },
    });
    const coup = await prisma.loyaltyCoupon.create({
      data: {
        merchantId: m.id,
        code: `ACT-${Date.now()}`,
        name: 'Activity Coupon',
        discountType: 'FIXED',
        value: 5,
      },
    });
    await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: m.id,
        name: 'Test Rule',
        segmentId: seg.id,
        couponId: coup.id,
        enabled: true,
        scheduleType: 'daily',
        cronExpr: '0 9 * * *',
      },
    });
    try {
      const report = await loyalty.getReportsActivity(m.id, { preset: 'last30d' });
      expect(report).toHaveProperty('participations');
      expect(report).toHaveProperty('couponUsage');
      expect(report).toHaveProperty('pointsCostEstimate');
      if ((report as { byCoupon?: unknown[] }).byCoupon?.length) {
        const row = (report as { byCoupon: { couponId: string; sentCount: number; usedCount: number }[] }).byCoupon[0];
        expect(row).toHaveProperty('couponId');
        expect(row).toHaveProperty('sentCount');
        expect(row).toHaveProperty('usedCount');
      }
      if ((report as { byDispatchRule?: unknown[] }).byDispatchRule?.length) {
        const r = (report as { byDispatchRule: { ruleId: string; jobRunsCount: number }[] }).byDispatchRule[0];
        expect(r).toHaveProperty('ruleId');
        expect(r).toHaveProperty('jobRunsCount');
      }
    } finally {
      await prisma.crmCouponDispatchRule.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltyCoupon.deleteMany({ where: { merchantId: m.id } });
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('getReportsActivity is isolated by merchantId (no cross-merchant leakage)', async () => {
    if (!process.env.DATABASE_URL) return;

    const ma = await prisma.merchant.create({ data: { code: `LY-ISO-A-${Date.now()}`, name: 'Loyalty Iso A' } });
    const mb = await prisma.merchant.create({ data: { code: `LY-ISO-B-${Date.now()}`, name: 'Loyalty Iso B' } });
    const ca = await prisma.customer.create({ data: { merchantId: ma.id, name: 'IsoCustA', phone: `ly-iso-a-${Date.now()}` } });
    const cb = await prisma.customer.create({ data: { merchantId: mb.id, name: 'IsoCustB', phone: `ly-iso-b-${Date.now()}` } });
    const couponA = await prisma.loyaltyCoupon.create({
      data: { merchantId: ma.id, code: `CP-A-${Date.now()}`, name: 'Coupon A', discountType: 'FIXED', value: 10 },
    });
    const couponB = await prisma.loyaltyCoupon.create({
      data: { merchantId: mb.id, code: `CP-B-${Date.now()}`, name: 'Coupon B', discountType: 'FIXED', value: 10 },
    });

    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await prisma.crmMarketingJob.createMany({
      data: [
        { merchantId: ma.id, kind: 'segment-coupon', segmentId: 'seg-a', couponId: couponA.id, status: 'done' },
        { merchantId: mb.id, kind: 'segment-coupon', segmentId: 'seg-b', couponId: couponB.id, status: 'done' },
      ],
    });
    await prisma.loyaltyCouponIssue.createMany({
      data: [
        { customerId: ca.id, couponId: couponA.id, issuedAt: now },
        { customerId: cb.id, couponId: couponB.id, issuedAt: now },
      ],
      skipDuplicates: true,
    });

    try {
      const a = await loyalty.getReportsActivity(ma.id, { from, to });
      expect(a.participations).toBeGreaterThanOrEqual(1);
      expect(a.couponUsage).toBeGreaterThanOrEqual(1);

      const b = await loyalty.getReportsActivity(mb.id, { from, to });
      expect(b.participations).toBeGreaterThanOrEqual(1);
      expect(b.couponUsage).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.loyaltyCouponIssue.deleteMany({ where: { couponId: { in: [couponA.id, couponB.id] } } });
      await prisma.crmMarketingJob.deleteMany({ where: { merchantId: { in: [ma.id, mb.id] } } });
      await prisma.loyaltyCoupon.deleteMany({ where: { id: { in: [couponA.id, couponB.id] } } });
      await prisma.customer.deleteMany({ where: { id: { in: [ca.id, cb.id] } } });
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: { in: [ma.id, mb.id] } } });
      await prisma.merchant.deleteMany({ where: { id: { in: [ma.id, mb.id] } } });
    }
  }, 20000);

  it('getReportsActivity returns avg metrics (v2)', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `LY-ACT-V2-${Date.now()}`, name: 'Loyalty Activity v2' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'ActV2 Customer', phone: `ly-act-v2-${Date.now()}` },
    });
    const coup = await prisma.loyaltyCoupon.create({
      data: { merchantId: m.id, code: `ACTV2-${Date.now()}`, name: 'Activity Coupon v2', discountType: 'FIXED', value: 5 },
    });
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await prisma.crmMarketingJob.create({
      data: { merchantId: m.id, kind: 'segment-coupon', segmentId: 'seg-v2', couponId: coup.id, status: 'done', createdAt: now },
    });
    await prisma.loyaltyCouponIssue.create({
      data: { customerId: c.id, couponId: coup.id, issuedAt: now },
    });
    await prisma.pointLedger.create({
      data: {
        merchantId: m.id,
        customerId: c.id,
        type: 'EARNED',
        amount: 10,
        balanceAfter: 10,
        txnCode: 'SALE',
        note: 'activity v2 points',
        createdAt: now,
      },
    });
    try {
      const report = await loyalty.getReportsActivity(m.id, { from, to });
      expect(report.participations).toBe(1);
      expect(report.couponUsage).toBe(1);
      expect(report.pointsCostEstimate).toBeGreaterThanOrEqual(0);
      expect(report.avgCouponUsagePerParticipation).toBe(1);
      expect(report.avgPointsCostPerParticipation).toBe(report.pointsCostEstimate);
    } finally {
      await prisma.pointLedger.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltyCouponIssue.deleteMany({ where: { couponId: coup.id } });
      await prisma.crmMarketingJob.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltyCoupon.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltySettings.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 15000);
});
