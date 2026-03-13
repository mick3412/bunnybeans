import { Body, Controller, Post } from '@nestjs/common';
import { FinanceEventType } from '@prisma/client';
import { FinanceService, RecordFinanceEventInput } from '../application/finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Post('events')
  recordEvent(
    @Body()
    body: {
      type: FinanceEventType;
      partyId?: string | null;
      currency: string;
      amount: number;
      taxAmount?: number;
      occurredAt?: string;
      referenceId?: string;
      note?: string;
    },
  ) {
    const input: RecordFinanceEventInput = {
      type: body.type,
      partyId: body.partyId,
      currency: body.currency,
      amount: body.amount,
      taxAmount: body.taxAmount,
      occurredAt: body.occurredAt,
      referenceId: body.referenceId,
      note: body.note,
    };
    return this.service.recordFinanceEvent(input);
  }
}
