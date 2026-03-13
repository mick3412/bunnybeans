import { Injectable } from '@nestjs/common';
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
}
