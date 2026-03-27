import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ReturnType,
  ReturnStatus,
  ReturnReason,
  ItemCondition,
  RefundMethod,
  Prisma,
  PrismaClient,
} from '@prisma/client';

export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface CreatePosReturnData {
  returnNumber: string;
  orderId: string;
  storeId: string;
  customerId: string | null;
  type: ReturnType;
  returnSubtotal: number;
  discountShare: number;
  refundAmount: number;
  refundMethod: RefundMethod;
  pointsDeducted: number;
  pointsReturned: number;
  exchangeOrderId?: string | null;
  note?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    reason: ReturnReason;
    condition: ItemCondition;
    note?: string | null;
  }>;
}

@Injectable()
export class PosReturnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePosReturnData, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.posReturn.create({
      data: {
        returnNumber: data.returnNumber,
        orderId: data.orderId,
        storeId: data.storeId,
        customerId: data.customerId,
        type: data.type,
        returnSubtotal: new Decimal(data.returnSubtotal),
        discountShare: new Decimal(data.discountShare),
        refundAmount: new Decimal(data.refundAmount),
        refundMethod: data.refundMethod,
        pointsDeducted: data.pointsDeducted,
        pointsReturned: data.pointsReturned,
        exchangeOrderId: data.exchangeOrderId ?? null,
        note: data.note ?? null,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            reason: item.reason,
            condition: item.condition,
            note: item.note ?? null,
          })),
        },
      },
      include: { items: true },
    });
  }

  async updateExchangeOrderId(id: string, exchangeOrderId: string, tx?: TxClient) {
    const client = tx ?? this.prisma;
    return client.posReturn.update({
      where: { id },
      data: { exchangeOrderId },
    });
  }

  async findById(id: string) {
    return this.prisma.posReturn.findUnique({
      where: { id },
      include: { items: true, order: { select: { orderNumber: true } } },
    });
  }

  async findMany(filter: {
    storeId?: string;
    type?: ReturnType;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.PosReturnWhereInput = {};
    if (filter.storeId) where.storeId = filter.storeId;
    if (filter.type) where.type = filter.type;
    if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.posReturn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.skip,
        take: filter.take,
        include: {
          items: true,
          order: { select: { orderNumber: true } },
        },
      }),
      this.prisma.posReturn.count({ where }),
    ]);
    return { items, total };
  }
}
