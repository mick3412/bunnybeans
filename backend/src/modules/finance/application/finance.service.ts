import { Injectable, BadRequestException } from '@nestjs/common';
import { FinanceEventType } from '@prisma/client';
import { FinanceRepository } from '../infrastructure/finance.repository';

export interface RecordFinanceEventInput {
  type: FinanceEventType;
  partyId?: string | null;
  currency: string;
  amount: number;
  taxAmount?: number;
  occurredAt?: string;
  referenceId?: string;
  note?: string;
}

const VALID_FINANCE_EVENT_TYPES: FinanceEventType[] = [
  'SALE_RECEIVABLE',
  'SALE_PAYMENT',
  'SALE_REFUND',
  'PURCHASE_PAYABLE',
  'PURCHASE_REBATE',
  'PURCHASE_RETURN',
  'ADJUSTMENT',
];

@Injectable()
export class FinanceService {
  constructor(private readonly repo: FinanceRepository) {}

  async recordFinanceEvent(input: RecordFinanceEventInput) {
    if (!VALID_FINANCE_EVENT_TYPES.includes(input.type)) {
      throw new BadRequestException({
        message: 'Unsupported FinanceEventType',
        code: 'FINANCE_UNSUPPORTED_EVENT_TYPE',
      });
    }
    if (!input.currency?.trim()) {
      throw new BadRequestException({
        message: 'currency is required',
        code: 'FINANCE_CURRENCY_REQUIRED',
      });
    }
    if (typeof input.amount !== 'number' || Number.isNaN(input.amount)) {
      throw new BadRequestException({
        message: 'amount must be a number',
        code: 'FINANCE_AMOUNT_INVALID',
      });
    }

    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const partyId = input.partyId != null && input.partyId !== '' ? input.partyId : '';

    return this.repo.appendEvent({
      type: input.type,
      partyId,
      currency: input.currency.trim(),
      amount: input.amount,
      taxAmount: input.taxAmount,
      occurredAt,
      referenceId: input.referenceId,
      note: input.note,
    });
  }
}
