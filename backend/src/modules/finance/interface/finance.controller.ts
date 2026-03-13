import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FinanceEventType } from '@prisma/client';
import { FinanceService, RecordFinanceEventInput } from '../application/finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('events')
  listEvents(
    @Query('partyId') partyId?: string,
    @Query('referenceId') referenceId?: string,
    @Query('type') type?: FinanceEventType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listFinanceEvents({
      partyId: partyId === '' ? undefined : partyId,
      referenceId: referenceId === '' ? undefined : referenceId,
      type,
      from,
      to,
      page: page != null ? parseInt(page, 10) : undefined,
      pageSize: pageSize != null ? parseInt(pageSize, 10) : undefined,
    });
  }

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
