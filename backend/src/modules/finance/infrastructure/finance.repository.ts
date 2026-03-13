import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { FinanceEventType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface RecordFinanceEventData {
  type: FinanceEventType;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount?: number;
  occurredAt: Date;
  referenceId?: string;
  note?: string;
}

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(data: RecordFinanceEventData) {
    return this.prisma.financeEvent.create({
      data: {
        type: data.type,
        partyId: data.partyId,
        currency: data.currency,
        amount: new Decimal(data.amount),
        taxAmount: data.taxAmount != null ? new Decimal(data.taxAmount) : null,
        occurredAt: data.occurredAt,
        referenceId: data.referenceId ?? null,
        note: data.note ?? null,
      },
    });
  }

  async listEvents(params: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.partyId !== undefined) where.partyId = params.partyId;
    if (params.referenceId !== undefined) where.referenceId = params.referenceId;
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }
    const skip = (params.page - 1) * params.pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.financeEvent.count({ where }),
      this.prisma.financeEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: params.pageSize,
      }),
    ]);
    return { items: rows, total };
  }
}
