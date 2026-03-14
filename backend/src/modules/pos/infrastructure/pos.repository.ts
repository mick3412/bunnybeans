import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const orderInclude = {
  items: true,
  payments: true,
  customer: true,
} as const;

export interface CreatePosOrderData {
  orderNumber: string;
  storeId: string;
  customerId?: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  promotionApplied?: object | null;
  items: { productId: string; quantity: number; unitPrice: number }[];
  payments: { method: string; amount: number }[];
}

@Injectable()
export class PosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(data: CreatePosOrderData) {
    const {
      orderNumber,
      storeId,
      customerId,
      subtotalAmount,
      discountAmount,
      totalAmount,
      promotionApplied,
      items,
      payments,
    } = data;
    return this.prisma.posOrder.create({
      data: {
        orderNumber,
        storeId,
        customerId: customerId ?? null,
        subtotalAmount: new Decimal(subtotalAmount),
        discountAmount: new Decimal(discountAmount),
        totalAmount: new Decimal(totalAmount),
        promotionApplied: promotionApplied ?? undefined,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
          })),
        },
        payments: {
          create: (payments ?? []).map((p) => ({
            method: p.method,
            amount: new Decimal(p.amount),
          })),
        },
      },
      include: orderInclude,
    });
  }

  async findById(id: string) {
    return this.prisma.posOrder.findUnique({
      where: { id },
      include: orderInclude,
    });
  }

  async appendPayment(
    orderId: string,
    p: { method: string; amount: number },
  ) {
    await this.prisma.posOrderPayment.create({
      data: {
        orderId,
        method: p.method,
        amount: new Decimal(p.amount),
      },
    });
    return this.findById(orderId).then((o) => {
      if (!o) throw new Error('Order missing after appendPayment');
      return o;
    });
  }

  async findMany(filter: {
    storeId?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where: {
      storeId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.from != null || filter.to != null) {
      where.createdAt = {};
      if (filter.from != null) where.createdAt.gte = filter.from;
      if (filter.to != null) where.createdAt.lte = filter.to;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.posOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.skip,
        take: filter.take,
        include: { customer: true },
      }),
      this.prisma.posOrder.count({ where }),
    ]);
    return { items, total };
  }

  /** 與 findMany 相同篩選；最多 1 萬筆；匯出用 */
  async findManyForExport(filter: {
    storeId?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: {
      storeId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.from != null || filter.to != null) {
      where.createdAt = {};
      if (filter.from != null) where.createdAt.gte = filter.from;
      if (filter.to != null) where.createdAt.lte = filter.to;
    }
    return this.prisma.posOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      include: { customer: true },
    });
  }

  /**
   * 匯出含明細：每元素 = 一筆訂單列 + 一筆明細；最多 maxLines 筆明細列（訂單無明細則仍一列 order、item 空）
   */
  async findLineRowsForExport(
    filter: { storeId?: string; from?: Date; to?: Date },
    maxLines: number,
  ) {
    const where: {
      storeId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.from != null || filter.to != null) {
      where.createdAt = {};
      if (filter.from != null) where.createdAt.gte = filter.from;
      if (filter.to != null) where.createdAt.lte = filter.to;
    }
    const out: Array<{
      order: Awaited<ReturnType<PosRepository['findManyForExport']>>[0] & {
        items: { id: string; productId: string; quantity: number; unitPrice: Decimal }[];
      };
      item: { id: string; productId: string; quantity: number; unitPrice: Decimal } | null;
    }> = [];
    let skip = 0;
    const batch = 60;
    while (out.length < maxLines) {
      const orders = await this.prisma.posOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: batch,
        include: { customer: true, items: true },
      });
      if (orders.length === 0) break;
      for (const o of orders) {
        const items = o.items;
        if (items.length === 0) {
          if (out.length >= maxLines) return out;
          out.push({ order: o, item: null });
          continue;
        }
        for (const item of items) {
          if (out.length >= maxLines) return out;
          out.push({ order: o, item });
        }
      }
      skip += batch;
    }
    return out;
  }
}
