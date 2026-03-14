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
  }) {
    return this.prisma.inventoryEvent.create({ data });
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
}

