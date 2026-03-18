import { Injectable } from '@nestjs/common';
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
   */
  async findExpiringBatches(filter: ExpiringBatchFilter) {
    const { warehouseId, productId, from, to, page, pageSize } = filter;
    try {
      const whClause = warehouseId ? `AND e."warehouseId" = $3` : '';
      const prodClause = productId ? `AND e."productId" = $4` : '';
      const params: any[] = [from, to, warehouseId, productId, pageSize, (page - 1) * pageSize];

      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          productId: string;
          warehouseId: string;
          batchCode: string | null;
          expiryDate: Date;
          onHandQty: number;
          sku: string | null;
          productName: string | null;
        }>
      >(
        `
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
          AND e."expiryDate" >= $1
          AND e."expiryDate" <= $2
          ${whClause}
          ${prodClause}
        GROUP BY e."productId", e."warehouseId", e."batchCode", e."expiryDate", p."sku", p."name"
        HAVING SUM(e."quantity") > 0
        ORDER BY e."expiryDate" ASC
        LIMIT $5 OFFSET $6
        `,
        ...params,
      );

      const totalRows = await this.prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `
        SELECT COUNT(*)::INT as total
        FROM (
          SELECT 1
          FROM "InventoryEvent" e
          WHERE
            e."expiryDate" IS NOT NULL
            AND e."expiryDate" >= $1
            AND e."expiryDate" <= $2
            ${whClause}
            ${prodClause}
          GROUP BY e."productId", e."warehouseId", e."batchCode", e."expiryDate"
          HAVING SUM(e."quantity") > 0
        ) t
        `,
        ...params.slice(0, 4),
      );
      const total = totalRows[0]?.total ?? 0;

      return {
        items: rows.map((r) => ({
          productId: r.productId,
          warehouseId: r.warehouseId,
          batchCode: r.batchCode,
          expiryDate: r.expiryDate,
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
}

