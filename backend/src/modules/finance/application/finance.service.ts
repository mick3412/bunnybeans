import { Injectable, BadRequestException } from '@nestjs/common';
import { FinanceEvent, FinanceEventType } from '@prisma/client';
import { FinanceRepository } from '../infrastructure/finance.repository';

export type FinanceEventRow = {
  id: string;
  type: FinanceEventType;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount: number | null;
  occurredAt: Date;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
};

function toRow(e: FinanceEvent): FinanceEventRow {
  return {
    id: e.id,
    type: e.type,
    partyId: e.partyId,
    currency: e.currency,
    amount: Number(e.amount),
    taxAmount: e.taxAmount != null ? Number(e.taxAmount) : null,
    occurredAt: e.occurredAt,
    referenceId: e.referenceId,
    note: e.note,
    createdAt: e.createdAt,
  };
}

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

    const created = await this.repo.appendEvent({
      type: input.type,
      partyId,
      currency: input.currency.trim(),
      amount: input.amount,
      taxAmount: input.taxAmount,
      occurredAt,
      referenceId: input.referenceId,
      note: input.note,
    });
    return toRow(created);
  }

  async listFinanceEvents(q: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = q.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
    if (page < 1 || pageSize < 1) {
      throw new BadRequestException({
        message: 'page must be >= 1, pageSize between 1 and 100',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({
        message: 'invalid from',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'invalid to',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    const { items, total } = await this.repo.listEvents({
      partyId: q.partyId,
      referenceId: q.referenceId,
      type: q.type,
      from,
      to,
      page,
      pageSize,
    });
    return {
      items: items.map(toRow),
      page,
      pageSize,
      total,
    };
  }
}
