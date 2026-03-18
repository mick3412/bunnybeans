import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { DatabaseModule } from '../../shared/database/database.module';
import { CrmModule } from './crm.module';
import { SegmentService } from './application/segment.service';
import { TierRuleService } from './application/tier-rule.service';
import { CrmJobService } from './application/crm-job.service';
import { DispatchRuleRunnerService } from './application/dispatch-rule-runner.service';
import { OpsService } from '../ops/application/ops.service';
import { Prisma } from '@prisma/client';

describe('SegmentService (integration)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  let segmentService: SegmentService;
  let tierRuleService: TierRuleService;
  let crmJobService: CrmJobService;
  let runner: DispatchRuleRunnerService;
  let ops: OpsService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        CrmModule,
      ],
    }).compile();
    prisma = app.get(PrismaService);
    segmentService = app.get(SegmentService);
    tierRuleService = app.get(TierRuleService);
    crmJobService = app.get(CrmJobService);
    runner = app.get(DispatchRuleRunnerService);
    ops = app.get(OpsService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('getPreview returns customerIds and count for segment', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CRM-SEG-${Date.now()}`, name: 'Crm Seg' },
    });
    const c = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Seg Customer', status: 'ACTIVE' },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'All Active' },
    });
    try {
      const out = await segmentService.getPreview(seg.id);
      expect(out).toHaveProperty('customerIds');
      expect(out).toHaveProperty('count');
      expect(Array.isArray(out.customerIds)).toBe(true);
      expect(out.count).toBeGreaterThanOrEqual(1);
      expect(out.customerIds).toContain(c.id);
    } finally {
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('getPreview throws SEGMENT_NOT_FOUND for unknown id', async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(segmentService.getPreview('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      response: { code: 'SEGMENT_NOT_FOUND' },
    });
  });

  it('getPreview with conditions.memberLevel returns only matching customers', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CRM-SEG-ML-${Date.now()}`, name: 'Crm Seg ML' },
    });
    const vip = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Vip Only', status: 'ACTIVE', memberLevel: 'VIP' },
    });
    const gold = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Gold Only', status: 'ACTIVE', memberLevel: 'GOLD' },
    });
    const segVip = await prisma.segment.create({
      data: {
        merchantId: m.id,
        name: 'VIP only',
        conditions: { memberLevel: 'VIP' },
      },
    });
    try {
      const out = await segmentService.getPreview(segVip.id);
      expect(out.count).toBe(1);
      expect(out.customerIds).toContain(vip.id);
      expect(out.customerIds).not.toContain(gold.id);
    } finally {
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('listSegments throws CRM_MERCHANT_REQUIRED when merchantId empty', async () => {
    if (!process.env.DATABASE_URL) return;
    await expect(segmentService.listSegments('')).rejects.toMatchObject({
      response: { code: 'CRM_MERCHANT_REQUIRED' },
    });
  });

  it('listSegments returns items and total for merchant', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CRM-LIST-${Date.now()}`, name: 'Crm List' },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'List Seg' },
    });
    try {
      const out = await segmentService.listSegments(m.id, 1, 10);
      expect(out).toHaveProperty('items');
      expect(out).toHaveProperty('total');
      expect(Array.isArray(out.items)).toBe(true);
      expect(out.total).toBeGreaterThanOrEqual(1);
      const found = out.items.find((s) => s.id === seg.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('List Seg');
      expect(found!.merchantId).toBe(m.id);
    } finally {
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('getExportCsv returns CSV with id,name,phone,memberLevel', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CRM-EXPORT-${Date.now()}`, name: 'Crm Export' },
    });
    const c = await prisma.customer.create({
      data: {
        merchantId: m.id,
        name: 'Export Test',
        phone: '0999999999',
        memberLevel: 'GOLD',
        status: 'ACTIVE',
      },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'Export Seg' },
    });
    try {
      const csv = await segmentService.getExportCsv(seg.id);
      expect(csv).toContain('id,name,phone,memberLevel');
      expect(csv).toContain(c.id);
      expect(csv).toContain('Export Test');
      expect(csv).toContain('0999999999');
      expect(csv).toContain('GOLD');
    } finally {
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.customer.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
  }, 10000);

  it('recalcTiers upgrades customers based on SPEND_SUM lookbackDays and picks highest threshold', async () => {
    if (!process.env.DATABASE_URL) return;

    const m = await prisma.merchant.create({
      data: { code: `CRM-TIER-${Date.now()}`, name: 'Crm Tier' },
    });
    const store = await prisma.store.create({
      data: { code: `S-TIER-${Date.now()}`, name: 'Tier Store', merchantId: m.id },
    });
    const c1 = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Tier Customer 1', status: 'ACTIVE' },
    });
    const c2 = await prisma.customer.create({
      data: { merchantId: m.id, name: 'Tier Customer 2', status: 'ACTIVE' },
    });

    // rules: GOLD at 100 in last 30 days, VIP at 200 in last 30 days
    await prisma.tierRule.createMany({
      data: [
        {
          merchantId: m.id,
          name: 'GOLD by spend',
          ruleType: 'SPEND_SUM',
          threshold: 100,
          targetLevel: 'GOLD',
          lookbackDays: 30,
        },
        {
          merchantId: m.id,
          name: 'VIP by spend',
          ruleType: 'SPEND_SUM',
          threshold: 200,
          targetLevel: 'VIP',
          lookbackDays: 30,
        },
      ],
    });

    // c1 total 120 => GOLD; c2 total 220 => VIP
    await prisma.posOrder.create({
      data: {
        orderNumber: `POS-TIER-${Date.now()}-1`,
        storeId: store.id,
        customerId: c1.id,
        subtotalAmount: new Prisma.Decimal(120),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(120),
      },
    });
    await prisma.posOrder.create({
      data: {
        orderNumber: `POS-TIER-${Date.now()}-2`,
        storeId: store.id,
        customerId: c2.id,
        subtotalAmount: new Prisma.Decimal(220),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(220),
      },
    });

    const sanity = await prisma.posOrder.findMany({
      where: { storeId: store.id },
      select: { customerId: true, totalAmount: true },
    });
    expect(sanity.length).toBe(2);
    expect(sanity.some((o) => o.customerId === c1.id && (o.totalAmount as any).toNumber() === 120)).toBe(true);
    expect(sanity.some((o) => o.customerId === c2.id && (o.totalAmount as any).toNumber() === 220)).toBe(true);

    const out = await tierRuleService.recalcTiers(m.id);
    expect(out.updated).toBe(2);

    const c1After = await prisma.customer.findUnique({ where: { id: c1.id } });
    const c2After = await prisma.customer.findUnique({ where: { id: c2.id } });
    expect(c1After?.memberLevel).toBe('GOLD');
    expect(c2After?.memberLevel).toBe('VIP');

    // lookbackDays should exclude old orders
    const oldOrderDate = new Date();
    oldOrderDate.setDate(oldOrderDate.getDate() - 40);
    await prisma.posOrder.create({
      data: {
        orderNumber: `POS-TIER-${Date.now()}-OLD`,
        storeId: store.id,
        customerId: c1.id,
        subtotalAmount: 1000,
        discountAmount: 0,
        totalAmount: 1000,
        createdAt: oldOrderDate,
      },
    });
    // rerun should not change (still GOLD) and updated should be 0 because already GOLD and old order ignored
    const out2 = await tierRuleService.recalcTiers(m.id);
    expect(out2.updated).toBe(0);

    await prisma.posOrder.deleteMany({ where: { storeId: store.id } });
    await prisma.tierRule.deleteMany({ where: { merchantId: m.id } });
    await prisma.customer.deleteMany({ where: { merchantId: m.id } });
    await prisma.store.delete({ where: { id: store.id } });
    await prisma.merchant.delete({ where: { id: m.id } });
  }, 15000);

  it('listJobs returns paginated items and supports kind/from/to filters (integration)', async () => {
    if (!process.env.DATABASE_URL) return;
    const m = await prisma.merchant.create({
      data: { code: `CRM-JOBS-${Date.now()}`, name: 'Crm Jobs' },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'Jobs Seg' },
    });
    const coupon = await prisma.loyaltyCoupon.create({
      data: { merchantId: m.id, code: `C-J-${Date.now()}`, name: 'Jobs Coupon', discountType: 'FIXED', value: 10, active: true },
    });
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const recent = new Date();
    try {
      const j1 = await prisma.crmMarketingJob.create({
        data: { merchantId: m.id, kind: 'segment-coupon', segmentId: seg.id, couponId: coupon.id, status: 'done', createdAt: old },
      });
      const j2 = await prisma.crmMarketingJob.create({
        data: { merchantId: m.id, kind: 'repurchase-coupon', segmentId: seg.id, couponId: coupon.id, status: 'pending', createdAt: recent },
      });
      const all = await crmJobService.listJobs({ merchantId: m.id, page: 1, pageSize: 20 });
      expect(all.total).toBeGreaterThanOrEqual(2);
      expect(all.items.some((x) => x.id === j1.id)).toBe(true);
      expect(all.items.some((x) => x.id === j2.id)).toBe(true);

      const filteredKind = await crmJobService.listJobs({ merchantId: m.id, kind: 'repurchase-coupon', page: 1, pageSize: 20 });
      expect(filteredKind.items.every((x) => x.kind === 'repurchase-coupon')).toBe(true);

      const from = new Date();
      from.setDate(from.getDate() - 1);
      const ranged = await crmJobService.listJobs({ merchantId: m.id, from: from.toISOString(), page: 1, pageSize: 20 });
      expect(ranged.items.some((x) => x.id === j1.id)).toBe(false);
      expect(ranged.items.some((x) => x.id === j2.id)).toBe(true);
    } finally {
      await prisma.crmMarketingJob.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltyCouponIssue.deleteMany({ where: { couponId: coupon.id } });
      await prisma.loyaltyCoupon.deleteMany({ where: { merchantId: m.id } });
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.deleteMany({ where: { id: m.id } });
    }
  }, 15000);

  it('dispatch-rule runner skeleton triggers jobs and writes OpsJobRunLog (integration)', async () => {
    if (!process.env.DATABASE_URL) return;

    const m = await prisma.merchant.create({
      data: { code: `CRM-DR-${Date.now()}`, name: 'Crm Dispatch Rule' },
    });
    const seg = await prisma.segment.create({
      data: { merchantId: m.id, name: 'DR Seg' },
    });
    const coupon = await prisma.loyaltyCoupon.create({
      data: { merchantId: m.id, code: `C-DR-${Date.now()}`, name: 'DR Coupon', discountType: 'FIXED', value: 10, active: true },
    });
    const rule = await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: m.id,
        name: 'Daily Rule',
        segmentId: seg.id,
        couponId: coupon.id,
        enabled: true,
        scheduleType: 'daily',
        cronExpr: '0 9 * * *',
        nextRunAt: new Date(0),
      },
    });
    const badRule = await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: m.id,
        name: 'Bad Rule (missing coupon)',
        segmentId: seg.id,
        couponId: '',
        enabled: true,
        scheduleType: 'daily',
        cronExpr: '0 9 * * *',
        nextRunAt: new Date(0),
      },
    });
    const dupeRule = await prisma.crmCouponDispatchRule.create({
      data: {
        merchantId: m.id,
        name: 'Dupe Rule (same period)',
        segmentId: seg.id,
        couponId: coupon.id,
        enabled: true,
        scheduleType: 'daily',
        cronExpr: '0 9 * * *',
        nextRunAt: new Date(0),
        lastRunAt: new Date(),
        lastRunCode: 'SENT',
        lastRunNote: 'seed last run',
      },
    });
    try {
      const result = await runner.runScheduled();
      await ops.recordRun('crm-run-scheduled', result.errors.length === 0, result.errors.length ? result.errors.join('; ') : undefined);

      expect(result.triggered).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.some((x) => x.includes(badRule.id) && x.includes('CRM_JOB_COUPON_REQUIRED'))).toBe(true);
      const job = await prisma.crmMarketingJob.findFirst({
        where: { merchantId: m.id, segmentId: seg.id, couponId: coupon.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(job).toBeDefined();

      const updated = await prisma.crmCouponDispatchRule.findUnique({ where: { id: rule.id } });
      expect(updated?.nextRunAt).toBeDefined();
      expect((updated?.nextRunAt?.getTime() ?? 0) > 0).toBe(true);
      expect(updated?.lastRunCode).toBe('SENT');
      expect(updated?.lastRunNote ?? '').toContain('jobId=');

      const updatedBad = await prisma.crmCouponDispatchRule.findUnique({ where: { id: badRule.id } });
      expect(updatedBad?.lastRunCode).toBe('FAILED');
      expect(updatedBad?.lastRunNote ?? '').toContain('CRM_JOB_COUPON_REQUIRED');

      const updatedDupe = await prisma.crmCouponDispatchRule.findUnique({ where: { id: dupeRule.id } });
      expect(updatedDupe?.lastRunCode).toBe('SKIPPED');
      expect(updatedDupe?.lastRunNote ?? '').toContain('duplicate-protection');

      const runLog = await prisma.opsJobRunLog.findFirst({
        where: { jobType: 'crm-run-scheduled' },
        orderBy: { createdAt: 'desc' },
      });
      expect(runLog).toBeDefined();
      expect(runLog?.success).toBe(false);
      expect(runLog?.message ?? '').toContain('CRM_JOB_COUPON_REQUIRED');

      const list = await ops.listJobs({ kind: 'crm-run-scheduled', page: 1, pageSize: 20 });
      expect(list.items.some((x) => x.id === runLog?.id)).toBe(true);
    } finally {
      await prisma.opsJobRunLog.deleteMany({ where: { jobType: 'crm-run-scheduled' } });
      await prisma.crmMarketingJob.deleteMany({ where: { merchantId: m.id } });
      await prisma.crmCouponDispatchRule.deleteMany({ where: { merchantId: m.id } });
      await prisma.loyaltyCouponIssue.deleteMany({ where: { couponId: coupon.id } });
      await prisma.loyaltyCoupon.deleteMany({ where: { merchantId: m.id } });
      await prisma.segment.deleteMany({ where: { merchantId: m.id } });
      await prisma.merchant.deleteMany({ where: { id: m.id } });
    }
  }, 20000);
});
