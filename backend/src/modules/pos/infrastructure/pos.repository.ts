import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreatePosOrderData {
  orderNumber: string;
  storeId: string;
  totalAmount: number;
  items: { productId: string; quantity: number; unitPrice: number }[];
  payments: { method: string; amount: number }[];
}

@Injectable()
export class PosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(data: CreatePosOrderData) {
    const { orderNumber, storeId, totalAmount, items, payments } = data;
    return this.prisma.posOrder.create({
      data: {
        orderNumber,
        storeId,
        totalAmount: new Decimal(totalAmount),
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
      include: { items: true, payments: true },
    });
  }

  async findById(id: string) {
    return this.prisma.posOrder.findUnique({
      where: { id },
      include: { items: true, payments: true },
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
      }),
      this.prisma.posOrder.count({ where }),
    ]);
    return { items, total };
  }
}
