import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class TierRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(merchantId: string) {
    return this.prisma.tierRule.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    merchantId: string,
    body: {
      name: string;
      ruleType: string;
      threshold: number;
      targetLevel: string;
      lookbackDays?: number;
    },
  ) {
    return this.prisma.tierRule.create({
      data: {
        merchantId,
        name: body.name,
        ruleType: body.ruleType,
        threshold: body.threshold,
        targetLevel: body.targetLevel,
        lookbackDays: body.lookbackDays ?? 365,
      },
    });
  }

  async update(
    merchantId: string,
    id: string,
    body: Partial<{ name: string; threshold: number; targetLevel: string; lookbackDays: number }>,
  ) {
    await this.prisma.tierRule.findFirstOrThrow({ where: { id, merchantId } });
    return this.prisma.tierRule.update({
      where: { id, merchantId },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.threshold != null && { threshold: body.threshold }),
        ...(body.targetLevel != null && { targetLevel: body.targetLevel }),
        ...(body.lookbackDays != null && { lookbackDays: body.lookbackDays }),
      },
    });
  }

  async delete(merchantId: string, id: string) {
    await this.prisma.tierRule.findFirstOrThrow({ where: { id, merchantId } });
    return this.prisma.tierRule.delete({ where: { id, merchantId } });
  }

  /**
   * 依 TierRule 批次重算會員等級：SPEND_SUM = 區間內訂單總額達門檻則設為 targetLevel
   */
  async recalcTiers(merchantId: string): Promise<{ updated: number }> {
    const rules = await this.prisma.tierRule.findMany({
      where: { merchantId, ruleType: 'SPEND_SUM' },
      orderBy: [{ threshold: 'desc' }],
    });
    if (rules.length === 0) {
      return { updated: 0 };
    }

    const storeIds = (
      await this.prisma.store.findMany({
        where: { merchantId },
        select: { id: true },
      })
    ).map((s) => s.id);
    if (storeIds.length === 0) {
      return { updated: 0 };
    }

    // 對每位客戶，記錄「目前應套用的最高門檻規則」
    const bestByCustomer = new Map<
      string,
      { threshold: number; targetLevel: string }
    >();

    // 依每條規則的 lookbackDays 分別計算 spend sum，並只保留更高 threshold 的規則
    for (const rule of rules) {
      const since = new Date();
      since.setDate(since.getDate() - rule.lookbackDays);
      const threshold = Number(rule.threshold);

      const orders = await this.prisma.posOrder.findMany({
        where: {
          storeId: { in: storeIds },
          customerId: { not: null },
          createdAt: { gte: since },
        },
        select: { customerId: true, totalAmount: true },
      });

      const sumByCustomer = new Map<string, number>();
      for (const o of orders) {
        if (!o.customerId) continue;
        const amt = Number(o.totalAmount);
        sumByCustomer.set(o.customerId, (sumByCustomer.get(o.customerId) ?? 0) + amt);
      }

      for (const [customerId, sum] of sumByCustomer.entries()) {
        if (sum < threshold) continue;
        const prev = bestByCustomer.get(customerId);
        if (!prev || threshold > prev.threshold) {
          bestByCustomer.set(customerId, {
            threshold,
            targetLevel: rule.targetLevel,
          });
        }
      }
    }

    let totalUpdated = 0;
    // 寫回 DB：只在 memberLevel 真的不同時才計數 updated
    for (const [customerId, best] of bestByCustomer.entries()) {
      const r = await this.prisma.customer.updateMany({
        where: {
          id: customerId,
          merchantId,
          OR: [
            { memberLevel: null },
            { memberLevel: { not: best.targetLevel } },
          ],
        },
        data: { memberLevel: best.targetLevel },
      });
      totalUpdated += r.count;
    }

    return { updated: totalUpdated };
  }
}
