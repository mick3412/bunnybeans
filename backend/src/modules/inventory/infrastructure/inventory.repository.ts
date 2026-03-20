import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { InventoryEventType } from '@prisma/client';

interface InventoryEventFilter {
  productId?: string;
  warehouseId?: string;
  type?: InventoryEventType;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

interface InventoryBalanceFilter {
  productIds?: string[];
  warehouseIds?: string[];
}

interface ExpiringBatchFilter {
  warehouseId?: string;
  productId?: string;
  from: Date;
  to: Date;
  page: number;
  pageSize: number;
}

interface ExpiringProductSummaryFilter extends ExpiringBatchFilter {}

/** 以「到期日期 - 當天」計算即將到期天數（整天數）。 */
function daysUntilExpiry(expiryDate: Date): number {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const expDay = new Date(expiryDate.toISOString().slice(0, 10));
  return Math.round((expDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(data: {
    productId: string;
    warehouseId: string;
    type: InventoryEventType;
    quantity: number;
    occurredAt: Date;
    referenceId?: string;
    note?: string;
    batchCode?: string | null;
    expiryDate?: Date;
    weightUnit?: string | null;
  }) {
    // Prisma Client schema 可能尚未包含 batchCode/expiryDate/weightUnit；
    // 先用 Prisma create 寫入既有欄位，再用 raw SQL UPDATE 補上新增欄位（若 DB 已 migrate）。
    const {
      batchCode,
      expiryDate,
      weightUnit,
      ...rest
    } = data;
    const created = await this.prisma.inventoryEvent.create({ data: rest });
    if (batchCode != null || expiryDate != null || weightUnit != null) {
      try {
        await this.prisma.$executeRaw`
          UPDATE "InventoryEvent"
          SET
            "batchCode" = ${batchCode ?? null},
            "expiryDate" = ${expiryDate ?? null},
            "weightUnit" = ${weightUnit ?? null}
          WHERE "id" = ${created.id}
        `;
      } catch {
        // DB 尚未 migrate 或欄位不存在時，忽略以保持向後相容
      }
    }
    return created;
  }

  async findBalance(productId: string, warehouseId: string) {
    return this.prisma.inventoryBalance.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });
  }

  async upsertBalance(data: {
    productId: string;
    warehouseId: string;
    onHandQty: number;
  }) {
    const { productId, warehouseId, onHandQty } = data;
    return this.prisma.inventoryBalance.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
      create: {
        productId,
        warehouseId,
        onHandQty,
      },
      update: {
        onHandQty,
      },
    });
  }

  async findBalances(filter: InventoryBalanceFilter) {
    const { productIds, warehouseIds } = filter;
    return this.prisma.inventoryBalance.findMany({
      where: {
        productId: productIds && productIds.length > 0 ? { in: productIds } : undefined,
        warehouseId:
          warehouseIds && warehouseIds.length > 0 ? { in: warehouseIds } : undefined,
      },
    });
  }

  /** 單倉餘額匯出：最多 1 萬列，與 events/export 上限一致 */
  async findBalancesForExport(warehouseId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      orderBy: { productId: 'asc' },
      take: 10_000,
    });
  }

  async findEvents(filter: InventoryEventFilter) {
    const { productId, warehouseId, type, from, to, page, pageSize } = filter;
    const where = {
      productId: productId ?? undefined,
      warehouseId: warehouseId ?? undefined,
      type: type ?? undefined,
      occurredAt: {
        gte: from,
        lte: to,
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryEvent.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  /** 匯出用：最多 10000 筆，同篩選條件 */
  async findEventsExport(filter: Omit<InventoryEventFilter, 'page' | 'pageSize'>) {
    const { productId, warehouseId, type, from, to } = filter;
    const where = {
      productId: productId ?? undefined,
      warehouseId: warehouseId ?? undefined,
      type: type ?? undefined,
      occurredAt: {
        gte: from,
        lte: to,
      },
    };
    return this.prisma.inventoryEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 10_000,
    });
  }

  /**
   * 以 InventoryBalance onHandQty>0 與 InventoryEvent 的 batchCode/expiryDate 聚合取得即將到期批次。
   * 簡化實作：僅針對有 expiryDate 的事件做彙總。
   * 單一 SQL 查詢含 rows + total（COUNT(*) OVER()），取代 $queryRawUnsafe 消除 SQL injection 風險。
   */
  async findExpiringBatches(filter: ExpiringBatchFilter) {
    const { warehouseId, productId, from, to, page, pageSize } = filter;
    const offset = (page - 1) * pageSize;
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          productId: string;
          warehouseId: string;
          batchCode: string | null;
          expiryDate: Date;
          onHandQty: number;
          sku: string | null;
          productName: string | null;
          total: number;
        }>
      >(
        Prisma.sql`
        WITH grouped AS (
          SELECT
            e."productId" as "productId",
            e."warehouseId" as "warehouseId",
            e."batchCode" as "batchCode",
            e."expiryDate" as "expiryDate",
            CAST(SUM(e."quantity") AS INT) as "onHandQty",
            p."sku" as "sku",
            p."name" as "productName"
          FROM "InventoryEvent" e
          LEFT JOIN "Product" p ON p."id" = e."productId"
          WHERE
            e."expiryDate" IS NOT NULL
            AND e."expiryDate" >= ${from}
            AND e."expiryDate" <= ${to}
            ${warehouseId ? Prisma.sql`AND e."warehouseId" = ${warehouseId}` : Prisma.empty}
            ${productId ? Prisma.sql`AND e."productId" = ${productId}` : Prisma.empty}
          GROUP BY e."productId", e."warehouseId", e."batchCode", e."expiryDate", p."sku", p."name"
          HAVING SUM(e."quantity") > 0
        ),
        counted AS (
          SELECT *, COUNT(*) OVER()::int AS total FROM grouped
        )
        SELECT * FROM counted
        ORDER BY "expiryDate" ASC
        LIMIT ${pageSize} OFFSET ${offset}
        `,
      );
      const total = rows[0]?.total ?? 0;
      return {
        items: rows.map((r) => ({
          productId: r.productId,
          warehouseId: r.warehouseId,
          batchCode: r.batchCode,
          expiryDate: r.expiryDate,
          daysUntilExpiry: daysUntilExpiry(r.expiryDate),
          onHandQty: r.onHandQty,
          sku: r.sku,
          productName: r.productName,
        })),
        page,
        pageSize,
        total,
      };
    } catch {
      // 欄位不存在（未 migrate）等情境：回空即可
      return { items: [], page, pageSize, total: 0 };
    }
  }

  /**
   * 即期庫存 summary（按 product 彙總）：回傳每商品最早效期、即期總量與 batches 明細。
   * batches 仍以 batchCode+expiryDate 聚合；summary 以 SQL 一次組裝，避免 service 端 N+1。
   * 使用 Prisma.sql 參數化查詢，消除 SQL injection 風險。
   */
  async findExpiringProductSummary(filter: ExpiringProductSummaryFilter) {
    const { warehouseId, productId, from, to, page, pageSize } = filter;
    const offset = (page - 1) * pageSize;
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          productId: string;
          sku: string | null;
          productName: string | null;
          earliestExpiryDate: Date;
          expiringQty: number;
          batches: unknown;
        }>
      >(
        Prisma.sql`
        WITH batches AS (
          SELECT
            e."productId" as "productId",
            e."warehouseId" as "warehouseId",
            e."batchCode" as "batchCode",
            e."expiryDate" as "expiryDate",
            CAST(SUM(e."quantity") AS INT) as "onHandQty"
          FROM "InventoryEvent" e
          WHERE
            e."expiryDate" IS NOT NULL
            AND e."expiryDate" >= ${from}
            AND e."expiryDate" <= ${to}
            ${warehouseId ? Prisma.sql`AND e."warehouseId" = ${warehouseId}` : Prisma.empty}
            ${productId ? Prisma.sql`AND e."productId" = ${productId}` : Prisma.empty}
          GROUP BY e."productId", e."warehouseId", e."batchCode", e."expiryDate"
          HAVING SUM(e."quantity") > 0
        )
        SELECT
          b."productId" as "productId",
          p."sku" as "sku",
          p."name" as "productName",
          MIN(b."expiryDate") as "earliestExpiryDate",
          CAST(SUM(b."onHandQty") AS INT) as "expiringQty",
          json_agg(
            json_build_object(
              'warehouseId', b."warehouseId",
              'batchCode', b."batchCode",
              'expiryDate', b."expiryDate",
              'onHandQty', b."onHandQty"
            )
            ORDER BY b."expiryDate" ASC
          ) as "batches"
        FROM batches b
        LEFT JOIN "Product" p ON p."id" = b."productId"
        GROUP BY b."productId", p."sku", p."name"
        ORDER BY MIN(b."expiryDate") ASC
        LIMIT ${pageSize} OFFSET ${offset}
        `,
      );

      const totalRows = await this.prisma.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`
        WITH batches AS (
          SELECT
            e."productId" as "productId",
            e."warehouseId" as "warehouseId",
            e."batchCode" as "batchCode",
            e."expiryDate" as "expiryDate"
          FROM "InventoryEvent" e
          WHERE
            e."expiryDate" IS NOT NULL
            AND e."expiryDate" >= ${from}
            AND e."expiryDate" <= ${to}
            ${warehouseId ? Prisma.sql`AND e."warehouseId" = ${warehouseId}` : Prisma.empty}
            ${productId ? Prisma.sql`AND e."productId" = ${productId}` : Prisma.empty}
          GROUP BY e."productId", e."warehouseId", e."batchCode", e."expiryDate"
          HAVING SUM(e."quantity") > 0
        )
        SELECT COUNT(*)::INT as total
        FROM (
          SELECT 1
          FROM batches
          GROUP BY "productId"
        ) t
        `,
      );
      const total = totalRows[0]?.total ?? 0;

      return {
        items: rows.map((r) => {
          const batches = Array.isArray(r.batches)
            ? (r.batches as Array<{ warehouseId?: string; batchCode?: string | null; expiryDate?: string | Date; onHandQty?: number }>).map(
                (b) => ({
                  ...b,
                  daysUntilExpiry: b.expiryDate
                    ? daysUntilExpiry(b.expiryDate instanceof Date ? b.expiryDate : new Date(b.expiryDate))
                    : undefined,
                }),
              )
            : [];
          return {
            productId: r.productId,
            sku: r.sku,
            productName: r.productName,
            earliestExpiryDate: r.earliestExpiryDate,
            earliestDaysUntilExpiry: daysUntilExpiry(r.earliestExpiryDate),
            expiringQty: r.expiringQty,
            batches,
          };
        }),
        page,
        pageSize,
        total,
      };
    } catch {
      return { items: [], page, pageSize, total: 0 };
    }
  }
}

