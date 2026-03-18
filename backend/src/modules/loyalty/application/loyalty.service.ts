import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PointLedgerType } from '@prisma/client';

const REPORT_PRESETS = ['today', 'last7d', 'last30d', 'currentMonth', 'last60d', 'lastHalfYear'] as const;

function parseReportRange(preset?: string, fromStr?: string, toStr?: string): { from: Date; to: Date; presetUsed?: string } {
  if (fromStr?.trim() && toStr?.trim()) {
    const from = new Date(fromStr.trim());
    const to = new Date(toStr.trim());
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
  }
  const p = REPORT_PRESETS.includes((preset ?? '') as (typeof REPORT_PRESETS)[0]) ? (preset as string) : 'last30d';
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  switch (p) {
    case 'today':
      return { from, to, presetUsed: p };
    case 'last7d':
      from.setDate(from.getDate() - 6);
      return { from, to, presetUsed: p };
    case 'last30d':
      from.setDate(from.getDate() - 29);
      return { from, to, presetUsed: p };
    case 'currentMonth':
      from.setDate(1);
      return { from, to, presetUsed: p };
    case 'last60d':
      from.setDate(from.getDate() - 59);
      return { from, to, presetUsed: p };
    case 'lastHalfYear':
      from.setDate(from.getDate() - 179);
      return { from, to, presetUsed: p };
    default:
      from.setDate(from.getDate() - 29);
      return { from, to, presetUsed: 'last30d' };
  }
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(merchantId: string) {
    let s = await this.prisma.loyaltySettings.findUnique({
      where: { merchantId },
    });
    if (!s) {
      s = await this.prisma.loyaltySettings.create({
        data: { merchantId },
      });
    }
    return {
      merchantId: s.merchantId,
      earnPerNT: Number(s.earnPerNT),
      pointValueNT: Number(s.pointValueNT),
      birthdayMultiplier: Number(s.birthdayMultiplier),
      rollingDays: s.rollingDays,
      notifyDaysBefore: s.notifyDaysBefore,
    };
  }

  async patchSettings(
    merchantId: string,
    body: Partial<{
      earnPerNT: number;
      pointValueNT: number;
      birthdayMultiplier: number;
      rollingDays: number;
      notifyDaysBefore: number;
    }>,
  ) {
    await this.getSettings(merchantId);
    const s = await this.prisma.loyaltySettings.update({
      where: { merchantId },
      data: {
        ...(body.earnPerNT != null && { earnPerNT: body.earnPerNT }),
        ...(body.pointValueNT != null && { pointValueNT: body.pointValueNT }),
        ...(body.birthdayMultiplier != null && {
          birthdayMultiplier: body.birthdayMultiplier,
        }),
        ...(body.rollingDays != null && { rollingDays: body.rollingDays }),
        ...(body.notifyDaysBefore != null && {
          notifyDaysBefore: body.notifyDaysBefore,
        }),
      },
    });
    return {
      merchantId: s.merchantId,
      earnPerNT: Number(s.earnPerNT),
      pointValueNT: Number(s.pointValueNT),
      birthdayMultiplier: Number(s.birthdayMultiplier),
      rollingDays: s.rollingDays,
      notifyDaysBefore: s.notifyDaysBefore,
    };
  }

  async getBalance(customerId: string): Promise<number> {
    const last = await this.prisma.pointLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return last?.balanceAfter ?? 0;
  }

  async appendLedger(params: {
    merchantId: string;
    customerId: string;
    type: PointLedgerType;
    amount: number;
    txnCode?: string;
    referenceId?: string;
    note?: string;
  }) {
    const prev = await this.getBalance(params.customerId);
    const balanceAfter = prev + params.amount;
    return this.prisma.pointLedger.create({
      data: {
        merchantId: params.merchantId,
        customerId: params.customerId,
        type: params.type,
        amount: params.amount,
        balanceAfter,
        txnCode: params.txnCode ?? null,
        referenceId: params.referenceId ?? null,
        note: params.note ?? null,
      },
    });
  }

  async recordEarnedFromOrder(params: {
    merchantId: string;
    customerId: string;
    orderId: string;
    totalAmount: number;
    pointsMultiplier?: number;
  }) {
    const settings = await this.getSettings(params.merchantId);
    const earnPer = settings.earnPerNT;
    if (earnPer <= 0) return null;
    const mRaw = Number(params.pointsMultiplier ?? 1);
    const m = Number.isFinite(mRaw) && mRaw > 0 ? mRaw : 1;
    const basePoints = Math.floor(params.totalAmount / earnPer);
    const points = Math.floor(basePoints * m);
    if (points <= 0) return null;
    return this.appendLedger({
      merchantId: params.merchantId,
      customerId: params.customerId,
      type: PointLedgerType.EARNED,
      amount: points,
      txnCode: 'SALE',
      referenceId: params.orderId,
      note: `訂單 ${params.orderId} 消費贈點`,
    });
  }

  /** 結帳折抵：寫入 BURNED；餘額不足時拋錯 */
  async recordBurnedFromOrder(params: {
    merchantId: string;
    customerId: string;
    orderId: string;
    points: number;
  }) {
    if (params.points <= 0) return null;
    const balance = await this.getBalance(params.customerId);
    if (balance < params.points) {
      throw new BadRequestException({
        message: 'Points balance insufficient for redemption',
        code: 'LOYALTY_INSUFFICIENT_POINTS',
      });
    }
    return this.appendLedger({
      merchantId: params.merchantId,
      customerId: params.customerId,
      type: PointLedgerType.BURNED,
      amount: -params.points,
      txnCode: 'SALE',
      referenceId: params.orderId,
      note: `訂單 ${params.orderId} 點數折抵`,
    });
  }

  async incrementRuleUsage(ruleIds: string[]) {
    const uniq = [...new Set(ruleIds.filter(Boolean))];
    for (const id of uniq) {
      await this.prisma.promotionRule.updateMany({
        where: { id },
        data: { usageCount: { increment: 1 } },
      });
    }
  }

  async listLedger(merchantId: string, customerId: string, limit = 50) {
    return this.prisma.pointLedger.findMany({
      where: { merchantId, customerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /** 全店最近流水（customerId 可選後篩選） */
  async listLedgerMerchantWide(merchantId: string, limit = 100) {
    return this.prisma.pointLedger.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 300),
      include: { customer: { select: { id: true, name: true } } },
    });
  }

  async dashboard(merchantId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      issued,
      redeemed,
      customersWithPoints,
      totalBurned,
      circulatingRows,
      newMembersMonth,
      ongoingCount,
      recentRows,
      activeRules,
    ] = await Promise.all([
      this.prisma.pointLedger.aggregate({
        where: {
          merchantId,
          type: PointLedgerType.EARNED,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      this.prisma.pointLedger.aggregate({
        where: {
          merchantId,
          type: PointLedgerType.BURNED,
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<{ c: bigint }[]>`
        SELECT COUNT(DISTINCT pl."customerId")::bigint AS c
        FROM "PointLedger" pl
        INNER JOIN (
          SELECT "customerId", MAX("createdAt") AS mx
          FROM "PointLedger"
          WHERE "merchantId" = ${merchantId}
          GROUP BY "customerId"
        ) t ON pl."customerId" = t."customerId" AND pl."createdAt" = t.mx
        WHERE pl."merchantId" = ${merchantId} AND pl."balanceAfter" > 0
      `,
      this.prisma.pointLedger.aggregate({
        where: { merchantId, type: PointLedgerType.BURNED },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<{ s: bigint }[]>`
        WITH last_bal AS (
          SELECT DISTINCT ON ("customerId") "balanceAfter"
          FROM "PointLedger"
          WHERE "merchantId" = ${merchantId}
          ORDER BY "customerId", "createdAt" DESC
        )
        SELECT COALESCE(SUM("balanceAfter"), 0)::bigint AS s FROM last_bal WHERE "balanceAfter" > 0
      `,
      this.prisma.customer.count({
        where: { merchantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.promotionRule.count({
        where: {
          merchantId,
          draft: false,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      }),
      this.prisma.pointLedger.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { customer: { select: { name: true } } },
      }),
      this.prisma.promotionRule.findMany({
        where: {
          merchantId,
          draft: false,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { priority: 'asc' },
        take: 8,
        select: {
          id: true,
          name: true,
          usageCount: true,
          startsAt: true,
          endsAt: true,
        },
      }),
    ]);

    return {
      pointsIssued30d: issued._sum.amount ?? 0,
      pointsRedeemed30d: Math.abs(redeemed._sum.amount ?? 0),
      activeMembersWithPoints: Number(customersWithPoints[0]?.c ?? 0),
      circulatingPointsTotal: Number(circulatingRows[0]?.s ?? 0),
      newMembersThisMonth: newMembersMonth,
      totalPointsBurnedLifetime: Math.abs(totalBurned._sum.amount ?? 0),
      ongoingPromotionsCount: ongoingCount,
      recentLedger: recentRows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: r.customer.name,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        referenceId: r.referenceId,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
      activePromotions: activeRules.map((r) => ({
        id: r.id,
        name: r.name,
        usageCount: r.usageCount,
        startsAt: r.startsAt?.toISOString() ?? null,
        endsAt: r.endsAt?.toISOString() ?? null,
      })),
    };
  }

  async listCoupons(merchantId: string) {
    return this.prisma.loyaltyCoupon.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(
    merchantId: string,
    body: {
      code: string;
      name: string;
      discountType: string;
      value: number;
      validFrom?: string;
      validTo?: string;
      maxUses?: number;
      active?: boolean;
    },
  ) {
    return this.prisma.loyaltyCoupon.create({
      data: {
        merchantId,
        code: body.code.trim(),
        name: body.name,
        discountType: body.discountType,
        value: body.value,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validTo: body.validTo ? new Date(body.validTo) : null,
        maxUses: body.maxUses ?? null,
        active: body.active ?? true,
      },
    });
  }

  async updateCoupon(
    merchantId: string,
    id: string,
    body: Partial<{
      name: string;
      value: number;
      validFrom: string | null;
      validTo: string | null;
      maxUses: number | null;
      active: boolean;
    }>,
  ) {
    return this.prisma.loyaltyCoupon.update({
      where: { id, merchantId },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.value != null && { value: body.value }),
        ...(body.validFrom !== undefined && {
          validFrom: body.validFrom ? new Date(body.validFrom) : null,
        }),
        ...(body.validTo !== undefined && {
          validTo: body.validTo ? new Date(body.validTo) : null,
        }),
        ...(body.maxUses !== undefined && { maxUses: body.maxUses }),
        ...(body.active != null && { active: body.active }),
      },
    });
  }

  /**
   * GET /loyalty/reports/activity — 活動／用券／點數成本報表（§6.8.2）
   * Query: merchantId、from、to、preset?、groupBy?
   * 擴充：byDispatchRule、byCoupon、revenueFromPointRedemption
   */
  async getReportsActivity(merchantId: string, q: { from?: string; to?: string; preset?: string; groupBy?: string }) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId is required' });
    }
    const { from, to, presetUsed } = parseReportRange(q.preset, q.from, q.to);

    const settings = await this.getSettings(m);
    const pointValueNT = Number(settings.pointValueNT);

    const [
      participationsAgg,
      couponUsageAgg,
      pointsEarned,
      couponByUsage,
      dispatchRules,
      couponStats,
      burnedRefIds,
    ] = await Promise.all([
      this.prisma.crmMarketingJob.count({
        where: { merchantId: m, status: 'done', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.loyaltyCouponIssue.count({
        where: { issuedAt: { gte: from, lte: to }, coupon: { merchantId: m } },
      }),
      this.prisma.pointLedger.aggregate({
        where: { merchantId: m, type: 'EARNED', createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      q.groupBy === 'couponId'
        ? this.prisma.loyaltyCouponIssue.groupBy({
            by: ['couponId'],
            where: { issuedAt: { gte: from, lte: to }, coupon: { merchantId: m } },
            _count: { id: true },
          })
        : Promise.resolve([]),
      this.prisma.crmCouponDispatchRule.findMany({
        where: { merchantId: m },
        select: { id: true, name: true, segmentId: true, couponId: true },
      }),
      this.prisma.loyaltyCoupon.findMany({
        where: { merchantId: m },
        select: { id: true, code: true, name: true, usedCount: true },
      }),
      this.prisma.pointLedger.findMany({
        where: {
          merchantId: m,
          type: PointLedgerType.BURNED,
          createdAt: { gte: from, lte: to },
          referenceId: { not: null },
        },
        select: { referenceId: true },
      }),
    ]);

    const participations = participationsAgg;
    const couponUsage = couponUsageAgg;
    const pointsCostEstimate = (pointsEarned._sum.amount ?? 0) * pointValueNT;
    const avgCouponUsagePerParticipation =
      participations > 0 ? Math.round((couponUsage / participations) * 10000) / 10000 : 0;
    const avgPointsCostPerParticipation =
      participations > 0 ? Math.round((pointsCostEstimate / participations) * 10000) / 10000 : 0;

    const couponUsageByCoupon =
      Array.isArray(couponByUsage) && couponByUsage.length
        ? couponByUsage.map((x) => ({ couponId: x.couponId, count: x._count.id }))
        : undefined;

    const issuedByCoupon = new Map<string, number>();
    for (const x of couponByUsage) {
      issuedByCoupon.set(x.couponId, x._count.id);
    }

    const byDispatchRule = await Promise.all(
      dispatchRules.map(async (r) => {
        const jobRunsCount = await this.prisma.crmMarketingJob.count({
          where: {
            merchantId: m,
            segmentId: r.segmentId,
            couponId: r.couponId,
            status: 'done',
            createdAt: { gte: from, lte: to },
          },
        });
        const sentCount = issuedByCoupon.get(r.couponId) ?? null;
        return {
          ruleId: r.id,
          ruleName: r.name,
          segmentId: r.segmentId,
          couponId: r.couponId,
          jobRunsCount,
          sentCount,
        };
      }),
    );

    const byCoupon = couponStats.map((c) => ({
      couponId: c.id,
      couponCode: c.code,
      name: c.name,
      sentCount: issuedByCoupon.get(c.id) ?? 0,
      usedCount: c.usedCount,
    }));

    const orderIds = [...new Set(burnedRefIds.map((x) => x.referenceId).filter((id): id is string => !!id))];
    let revenueFromPointRedemption: number | undefined;
    if (orderIds.length > 0) {
      const orders = await this.prisma.posOrder.aggregate({
        where: { id: { in: orderIds } },
        _sum: { totalAmount: true },
      });
      revenueFromPointRedemption = Number(orders._sum.totalAmount ?? 0);
    }

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      ...(presetUsed && { period: { preset: presetUsed, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } }),
      participations,
      couponUsage,
      pointsCostEstimate,
      avgCouponUsagePerParticipation,
      avgPointsCostPerParticipation,
      ...(couponUsageByCoupon && couponUsageByCoupon.length > 0 && { couponUsageByCoupon }),
      ...(byDispatchRule.length > 0 && { byDispatchRule }),
      ...(byCoupon.length > 0 && { byCoupon }),
      ...(revenueFromPointRedemption !== undefined && revenueFromPointRedemption >= 0 && { revenueFromPointRedemption }),
    };
  }

  /**
   * GET /loyalty/reports/members — 會員報表進階：區間內新會員、點數彙總、發券、等級分布
   * Query: merchantId、from、to、preset?
   */
  async getReportsMembers(merchantId: string, q: { from?: string; to?: string; preset?: string }) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId is required' });
    }
    const { from, to, presetUsed } = parseReportRange(q.preset, q.from, q.to);

    const [
      newMembersCount,
      pointsEarnedAgg,
      pointsBurnedAgg,
      couponIssuedCount,
      byMemberLevelRows,
      membersWithPointsCount,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { merchantId: m, createdAt: { gte: from, lte: to } },
      }),
      this.prisma.pointLedger.aggregate({
        where: { merchantId: m, type: PointLedgerType.EARNED, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.pointLedger.aggregate({
        where: { merchantId: m, type: PointLedgerType.BURNED, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.loyaltyCouponIssue.count({
        where: { issuedAt: { gte: from, lte: to }, coupon: { merchantId: m } },
      }),
      this.prisma.customer.groupBy({
        by: ['memberLevel'],
        where: { merchantId: m, status: 'ACTIVE' },
        _count: { id: true },
      }),
      this.prisma.$queryRaw<{ c: bigint }[]>`
        WITH last_bal AS (
          SELECT DISTINCT ON ("customerId") "balanceAfter"
          FROM "PointLedger"
          WHERE "merchantId" = ${m}
          ORDER BY "customerId", "createdAt" DESC
        )
        SELECT COUNT(*)::bigint AS c FROM last_bal WHERE "balanceAfter" > 0
      `,
    ]);

    const byMemberLevel = byMemberLevelRows.map((r) => ({
      memberLevel: r.memberLevel ?? '(null)',
      count: r._count.id,
    }));

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      ...(presetUsed && { period: { preset: presetUsed, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } }),
      newMembersCount,
      pointsEarned: pointsEarnedAgg._sum.amount ?? 0,
      pointsBurned: Math.abs(pointsBurnedAgg._sum.amount ?? 0),
      couponIssuedCount,
      membersWithPointsCount: Number(membersWithPointsCount[0]?.c ?? 0),
      byMemberLevel,
    };
  }
}
