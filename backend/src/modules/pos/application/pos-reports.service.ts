import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

const PRESETS = ['today', 'last7d', 'last30d', 'currentMonth', 'last60d', 'lastHalfYear'] as const;

function parsePresetToRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { start, end };
    case 'last7d':
      start.setDate(start.getDate() - 6);
      return { start, end };
    case 'last30d':
      start.setDate(start.getDate() - 29);
      return { start, end };
    case 'currentMonth':
      start.setDate(1);
      return { start, end };
    case 'last60d':
      start.setDate(start.getDate() - 59);
      return { start, end };
    case 'lastHalfYear':
      start.setDate(start.getDate() - 179);
      return { start, end };
    default:
      return { start, end };
  }
}

const MAX_REPORT_DAYS = 366;

/** Returns range or null when from/to not both provided. When both provided, throws on invalid range. */
function parseFromToOrThrow(
  fromStr?: string,
  toStr?: string,
): { start: Date; end: Date } | null {
  if (!fromStr?.trim() || !toStr?.trim()) return null;
  const start = new Date(fromStr.trim());
  const end = new Date(toStr.trim());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'Invalid from or to date' });
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException({ code: 'REPORT_INVALID_RANGE', message: 'from must be before or equal to to' });
  }
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  if (days > MAX_REPORT_DAYS) {
    throw new BadRequestException({ code: 'REPORT_RANGE_TOO_LARGE', message: `Range must not exceed ${MAX_REPORT_DAYS} days` });
  }
  return { start, end };
}

export interface PosReportsSummaryDto {
  totalRevenue: string;
  ordersCount: number;
  avgOrder: string;
  refundsCount: number;
  refundsTotal: string;
  period?: { preset?: string; from: string; to: string };
  byPaymentMethod?: Record<string, number>;
  byCategory?: { categoryId: string | null; categoryCode?: string; revenue: number }[];
  totalCost?: string;
  grossMargin?: string;
  grossMarginRate?: number | null;
}

@Injectable()
export class PosReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertStoreBelongsToMerchant(storeId: string, merchantId: string) {
    const ok = await this.prisma.store.findFirst({
      where: { id: storeId, merchantId },
      select: { id: true },
    });
    if (!ok) {
      throw new NotFoundException({ code: 'POS_STORE_NOT_FOUND', message: 'Store not found' });
    }
  }

  /**
   * 區間彙總：支援 preset 或 from/to、storeId；回傳 period、KPI、byPaymentMethod、byCategory
   */
  async summary(filter: {
    merchantId: string;
    preset?: string;
    from?: string;
    to?: string;
    storeId?: string;
  }): Promise<PosReportsSummaryDto> {
    let start: Date;
    let end: Date;
    let presetUsed: string | undefined;

    const fromTo = parseFromToOrThrow(filter.from, filter.to);
    if (fromTo) {
      start = fromTo.start;
      end = fromTo.end;
    } else {
      const p: string = PRESETS.includes((filter.preset ?? '') as (typeof PRESETS)[0])
        ? (filter.preset as string)
        : 'today';
      presetUsed = p;
      const range = parsePresetToRange(p);
      start = range.start;
      end = range.end;
    }

    const merchantId = filter.merchantId?.trim();
    if (!merchantId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId is required' });
    }
    const orderWhere: {
      createdAt: { gte: Date; lte: Date };
      storeId?: string;
      store?: { merchantId: string };
    } = {
      createdAt: { gte: start, lte: end },
      store: { merchantId },
    };
    if (filter.storeId?.trim()) {
      const storeId = filter.storeId.trim();
      await this.assertStoreBelongsToMerchant(storeId, merchantId);
      orderWhere.storeId = storeId;
    }

    const [ordersCount, aggOrders, refundAgg, paymentRows, categoryRows] = await Promise.all([
      this.prisma.posOrder.count({ where: orderWhere }),
      this.prisma.posOrder.aggregate({
        where: orderWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.$queryRaw<{ c: bigint; s: string | null }[]>`
        SELECT COUNT(*)::bigint AS c, COALESCE(SUM(ABS(amount)), 0)::text AS s
        FROM "FinanceEvent"
        WHERE type = 'SALE_REFUND'
          AND "occurredAt" >= ${start} AND "occurredAt" <= ${end}
          AND "partyId" IN (SELECT "partyId" FROM "Party" WHERE "merchantId" = ${merchantId})
      `,
      this.prisma.posOrderPayment.findMany({
        where: { order: orderWhere },
        select: { method: true, amount: true },
      }),
      this.prisma.posOrderItem.findMany({
        where: { order: orderWhere },
        select: {
          quantity: true,
          unitPrice: true,
          product: {
            select: {
              categoryId: true,
              category: { select: { code: true } },
              costPrice: true,
            },
          },
        },
      }),
    ]);

    const total = aggOrders._sum.totalAmount;
    const totalNum = total != null ? Number(total) : 0;
    const avgNum = ordersCount > 0 ? totalNum / ordersCount : 0;
    const r = refundAgg[0] ?? { c: 0n, s: '0' };

    const byPaymentMethod: Record<string, number> = {};
    for (const row of paymentRows) {
      const m = row.method || 'UNKNOWN';
      byPaymentMethod[m] = (byPaymentMethod[m] ?? 0) + Number(row.amount);
    }

    let totalCost = 0;
    const byCategoryMap = new Map<string | null, { revenue: number; code?: string }>();
    for (const row of categoryRows) {
      const rev = row.quantity * Number(row.unitPrice);
      const cost = row.quantity * (row.product?.costPrice != null ? Number(row.product.costPrice) : 0);
      totalCost += cost;
      const cid = row.product?.categoryId ?? null;
      const code = row.product?.category?.code;
      const cur = byCategoryMap.get(cid);
      if (!cur) byCategoryMap.set(cid, { revenue: rev, code });
      else cur.revenue += rev;
    }
    const byCategory = Array.from(byCategoryMap.entries()).map(([categoryId, v]) => ({
      categoryId,
      categoryCode: v.code,
      revenue: v.revenue,
    }));

    const period = {
      ...(presetUsed && { preset: presetUsed }),
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };

    const grossMargin = totalNum - totalCost;
    const grossMarginRate =
      totalNum > 0 ? Math.round((grossMargin / totalNum) * 10000) / 100 : null;
    return {
      totalRevenue: totalNum.toFixed(2),
      ordersCount,
      avgOrder: avgNum.toFixed(2),
      refundsCount: Number(r.c),
      refundsTotal: r.s ?? '0',
      period,
      byPaymentMethod: Object.keys(byPaymentMethod).length > 0 ? byPaymentMethod : undefined,
      byCategory: byCategory.length > 0 ? byCategory : undefined,
      totalCost: totalCost.toFixed(2),
      grossMargin: grossMargin.toFixed(2),
      ...(grossMarginRate !== null && { grossMarginRate }),
    };
  }

  /** 向後相容：本日彙總 */
  async todaySummary(merchantId: string, storeId?: string): Promise<PosReportsSummaryDto> {
    return this.summary({ merchantId, preset: 'today', storeId });
  }

  /**
   * GET /pos/reports/top-items — 區間內銷售品項排行（依數量或營收）
   */
  async getTopItems(filter: {
    merchantId: string;
    from?: string;
    to?: string;
    storeId?: string;
    limit?: number;
    sortBy?: 'quantity' | 'revenue';
  }) {
    let start: Date;
    let end: Date;
    const fromTo = parseFromToOrThrow(filter.from, filter.to);
    if (fromTo) {
      start = fromTo.start;
      end = fromTo.end;
    } else {
      const range = parsePresetToRange('last30d');
      start = range.start;
      end = range.end;
    }
    const merchantId = filter.merchantId?.trim();
    if (!merchantId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId is required' });
    }
    const orderWhere: {
      createdAt: { gte: Date; lte: Date };
      storeId?: string;
      store?: { merchantId: string };
    } = {
      createdAt: { gte: start, lte: end },
      store: { merchantId },
    };
    if (filter.storeId?.trim()) {
      const storeId = filter.storeId.trim();
      await this.assertStoreBelongsToMerchant(storeId, merchantId);
      orderWhere.storeId = storeId;
    }

    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const sortBy = filter.sortBy === 'revenue' ? 'revenue' : 'quantity';

    const rows = await this.prisma.posOrderItem.findMany({
      where: { order: orderWhere },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        product: { select: { name: true, sku: true } },
      },
    });

    const agg = new Map<
      string,
      { productId: string; productName: string; sku: string; quantity: number; revenue: number }
    >();
    for (const row of rows) {
      const rev = row.quantity * Number(row.unitPrice);
      const cur = agg.get(row.productId);
      if (!cur) {
        agg.set(row.productId, {
          productId: row.productId,
          productName: row.product?.name ?? '',
          sku: row.product?.sku ?? '',
          quantity: row.quantity,
          revenue: rev,
        });
      } else {
        cur.quantity += row.quantity;
        cur.revenue += rev;
      }
    }

    const list = Array.from(agg.values()).sort((a, b) =>
      sortBy === 'revenue' ? b.revenue - a.revenue : b.quantity - a.quantity,
    );
    return { items: list.slice(0, limit), from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  /**
   * GET /pos/reports/daily — 區間內按日彙總
   */
  async getDaily(filter: { merchantId: string; from?: string; to?: string; storeId?: string }) {
    let start: Date;
    let end: Date;
    const fromTo = parseFromToOrThrow(filter.from, filter.to);
    if (fromTo) {
      start = fromTo.start;
      end = fromTo.end;
    } else {
      const range = parsePresetToRange('last30d');
      start = range.start;
      end = range.end;
    }
    const merchantId = filter.merchantId?.trim();
    if (!merchantId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId is required' });
    }
    const orderWhere: {
      createdAt: { gte: Date; lte: Date };
      storeId?: string;
      store?: { merchantId: string };
    } = {
      createdAt: { gte: start, lte: end },
      store: { merchantId },
    };
    if (filter.storeId?.trim()) {
      const storeId = filter.storeId.trim();
      await this.assertStoreBelongsToMerchant(storeId, merchantId);
      orderWhere.storeId = storeId;
    }

    const orders = await this.prisma.posOrder.findMany({
      where: orderWhere,
      select: { createdAt: true, totalAmount: true },
    });

    const byDay = new Map<string, { revenue: number; ordersCount: number }>();
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(day);
      const amt = Number(o.totalAmount);
      if (!cur) byDay.set(day, { revenue: amt, ordersCount: 1 });
      else {
        cur.revenue += amt;
        cur.ordersCount += 1;
      }
    }
    const list = Array.from(byDay.entries())
      .map(([date, v]) => ({ date, revenue: v.revenue, ordersCount: v.ordersCount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { byDay: list, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
}
