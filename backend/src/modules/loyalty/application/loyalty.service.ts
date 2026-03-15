import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PointLedgerType } from '@prisma/client';

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
  }) {
    const settings = await this.getSettings(params.merchantId);
    const earnPer = settings.earnPerNT;
    if (earnPer <= 0) return null;
    const points = Math.floor(params.totalAmount / earnPer);
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
        SELECT COUNT(DISTINCT "customerId")::bigint AS c
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
}
