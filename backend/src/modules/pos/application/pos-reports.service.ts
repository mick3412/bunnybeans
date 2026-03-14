import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

export interface PosReportsSummaryDto {
  /** 本日訂單總金額（PosOrder.totalAmount 加總） */
  totalRevenue: string;
  /** 本日訂單筆數 */
  ordersCount: number;
  /** 本日平均每單金額 */
  avgOrder: string;
  /** 本日 SALE_REFUND 筆數 */
  refundsCount: number;
  /** 本日 SALE_REFUND 金額加總（正數字串） */
  refundsTotal: string;
}

@Injectable()
export class PosReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async todaySummary(): Promise<PosReportsSummaryDto> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [ordersCount, aggOrders, refundAgg] = await Promise.all([
      this.prisma.posOrder.count({
        where: { createdAt: { gte: start, lt: end } },
      }),
      this.prisma.posOrder.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _sum: { totalAmount: true },
      }),
      this.prisma.$queryRaw<{ c: bigint; s: string | null }[]>`
        SELECT
          COUNT(*)::bigint AS c,
          COALESCE(SUM(ABS(amount)), 0)::text AS s
        FROM "FinanceEvent"
        WHERE type = 'SALE_REFUND'
          AND "occurredAt" >= ${start}
          AND "occurredAt" < ${end}
      `,
    ]);

    const total = aggOrders._sum.totalAmount;
    const totalNum = total != null ? Number(total) : 0;
    const avgNum = ordersCount > 0 ? totalNum / ordersCount : 0;
    const r = refundAgg[0] ?? { c: 0n, s: '0' };

    return {
      totalRevenue: totalNum.toFixed(2),
      ordersCount,
      avgOrder: avgNum.toFixed(2),
      refundsCount: Number(r.c),
      refundsTotal: r.s ?? '0',
    };
  }
}
