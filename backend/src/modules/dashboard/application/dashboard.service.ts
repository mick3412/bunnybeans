import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/database/prisma.service';

export interface DashboardSummaryDto {
  productCount: number;
  skuOutOfStockCount: number;
  skuLowStockCount: number;
  ordersTodayCount: number;
  totalOnHandUnits: number;
  inventoryValueApprox: string;
  lowStockThreshold: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const threshold =
      Number(this.config.get('DASHBOARD_LOW_STOCK_THRESHOLD')) || 10;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      productCountRow,
      stockBucketsRow,
      ordersTodayRow,
      unitsRow,
      valueRow,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.$queryRaw<
        { out_of_stock: bigint; low_stock: bigint }[]
      >`
        WITH per_product AS (
          SELECT p.id, COALESCE(SUM(b."onHandQty"), 0)::int AS qty
          FROM "Product" p
          LEFT JOIN "InventoryBalance" b ON b."productId" = p.id
          GROUP BY p.id
        )
        SELECT
          COUNT(*) FILTER (WHERE qty = 0)::bigint AS out_of_stock,
          COUNT(*) FILTER (WHERE qty > 0 AND qty < ${threshold})::bigint AS low_stock
        FROM per_product
      `,
      this.prisma.posOrder.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.inventoryBalance.aggregate({
        _sum: { onHandQty: true },
      }),
      this.prisma.$queryRaw<{ val: string | null }[]>`
        SELECT COALESCE(SUM(b."onHandQty" * p."salePrice"), 0)::text AS val
        FROM "InventoryBalance" b
        JOIN "Product" p ON p.id = b."productId"
      `,
    ]);

    const buckets = stockBucketsRow[0] ?? {
      out_of_stock: 0n,
      low_stock: 0n,
    };
    const sumUnits = unitsRow._sum.onHandQty ?? 0;
    const valueStr = valueRow[0]?.val ?? '0';

    return {
      productCount: productCountRow,
      skuOutOfStockCount: Number(buckets.out_of_stock),
      skuLowStockCount: Number(buckets.low_stock),
      ordersTodayCount: ordersTodayRow,
      totalOnHandUnits: sumUnits,
      inventoryValueApprox: valueStr,
      lowStockThreshold: threshold,
    };
  }
}
