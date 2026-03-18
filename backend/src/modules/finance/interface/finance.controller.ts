import {
  Body,
  Controller,
  BadRequestException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FinanceEventType } from '@prisma/client';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { OpsService } from '../../ops/application/ops.service';
import { FinanceService, RecordFinanceEventInput } from '../application/finance.service';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly service: FinanceService,
    private readonly opsService: OpsService,
  ) {}

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

  @Get('balances')
  getBalances(
    @Query('merchantId') merchantId?: string,
    @Query('partyId') _partyId?: string,
    @Query('kind') _kind?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!merchantId?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId required' });
    }
    const kind =
      _kind === 'customer'
        ? ('customer' as const)
        : _kind === 'supplier'
          ? ('supplier' as const)
          : undefined;
    return this.service.getBalances({
      merchantId: merchantId.trim(),
      partyId: _partyId,
      kind,
      page: page != null ? parseInt(page, 10) : undefined,
      pageSize: pageSize != null ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('summary')
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('preset') preset?: string,
    @Query('groupBy') groupBy?: 'type' | 'partyId' | 'day' | 'week',
  ) {
    const g =
      groupBy === 'partyId'
        ? 'partyId'
        : groupBy === 'day'
          ? 'day'
          : groupBy === 'week'
            ? 'week'
            : 'type';
    return this.service.getSummary({
      from,
      to,
      preset: preset?.trim() || undefined,
      groupBy: g,
    });
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

  @Get('periods')
  @UseGuards(AdminApiKeyGuard)
  listPeriods(@Query('merchantId') merchantId?: string, @Query('status') status?: string) {
    return this.service.listPeriods({ merchantId, status });
  }

  @Post('periods/close')
  @UseGuards(AdminApiKeyGuard)
  async closePeriod(
    @Body() body: { startDate: string; endDate: string; merchantId?: string; closedBy?: string },
  ) {
    try {
      const result = await this.service.closePeriod(body ?? { startDate: '', endDate: '' });
      await this.opsService.recordRun('finance-period-close', true);
      return result;
    } catch (e) {
      await this.opsService.recordRun('finance-period-close', false, (e as Error).message);
      throw e;
    }
  }

  @Post('periods/:id/unlock')
  @UseGuards(AdminApiKeyGuard)
  unlockPeriod(@Param('id') id: string) {
    return this.service.unlockPeriod(id);
  }

  @Get('audit-log')
  @UseGuards(AdminApiKeyGuard)
  listAuditLog(
    @Query('eventId') eventId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('actor') actor?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listAuditLog({
      eventId,
      from,
      to,
      actor,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Post('snapshots')
  @UseGuards(AdminApiKeyGuard)
  async createSnapshot(@Body() body: { asOfDate: string; type: 'daily' | 'monthly' }) {
    try {
      const result = await this.service.createSnapshot(body ?? { asOfDate: new Date().toISOString().slice(0, 10), type: 'daily' });
      await this.opsService.recordRun('finance-snapshot', true);
      return result;
    } catch (e) {
      await this.opsService.recordRun('finance-snapshot', false, (e as Error).message);
      throw e;
    }
  }

  @Get('snapshots')
  @UseGuards(AdminApiKeyGuard)
  listSnapshots(
    @Query('type') type?: 'daily' | 'monthly',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listSnapshots({
      type,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('snapshots/:id')
  @UseGuards(AdminApiKeyGuard)
  getSnapshot(@Param('id') id: string) {
    return this.service.getSnapshotById(id);
  }

  @Get('snapshots/:id/download')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'application/json; charset=utf-8')
  async downloadSnapshot(
    @Res({ passthrough: false }) res: Response,
    @Param('id') id: string,
  ) {
    const snap = await this.service.getSnapshotById(id);
    const filename = `finance-snapshot-${snap.asOfDate}-${snap.type}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(snap.summary ?? {}, null, 2));
  }
}
