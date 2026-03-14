import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FinanceEventType } from '@prisma/client';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { FinanceService, RecordFinanceEventInput } from '../application/finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('events/export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="finance-events.csv"',
  )
  async exportEvents(
    @Res({ passthrough: false }) res: Response,
    @Query('partyId') partyId?: string,
    @Query('referenceId') referenceId?: string,
    @Query('type') type?: FinanceEventType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
  ) {
    const csv = await this.service.exportFinanceEventsCsv({
      partyId: partyId === '' ? undefined : partyId,
      referenceId: referenceId === '' ? undefined : referenceId,
      type,
      from,
      to,
      preset: preset?.trim() || undefined,
    });
    res.send('\uFEFF' + csv);
  }

  @Get('events')
  listEvents(
    @Query('partyId') partyId?: string,
    @Query('referenceId') referenceId?: string,
    @Query('type') type?: FinanceEventType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listFinanceEvents({
      partyId: partyId === '' ? undefined : partyId,
      referenceId: referenceId === '' ? undefined : referenceId,
      type,
      from,
      to,
      preset: preset?.trim() || undefined,
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
