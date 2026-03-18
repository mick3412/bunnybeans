import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PosReportsService } from '../application/pos-reports.service';

@Controller('pos/reports')
export class PosReportsController {
  constructor(private readonly reports: PosReportsService) {}

  /**
   * 區間彙總：query preset（today｜last7d｜last30d｜currentMonth｜last60d｜lastHalfYear）或 from／to；storeId 選填。
   * 回傳 period、totalRevenue、ordersCount、avgOrder、refundsCount、refundsTotal、byPaymentMethod、byCategory。
   */
  @Get('summary')
  summary(
    @Query('merchantId') merchantId?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!merchantId?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId required' });
    }
    return this.reports.summary({ merchantId: merchantId.trim(), preset, from, to, storeId });
  }

  /** 區間內銷售品項排行；query from、to、storeId?、limit（預設 20）、sortBy=quantity｜revenue */
  @Get('top-items')
  topItems(
    @Query('merchantId') merchantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'quantity' | 'revenue',
  ) {
    if (!merchantId?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId required' });
    }
    const lim = limit ? parseInt(limit, 10) : undefined;
    return this.reports.getTopItems({ merchantId: merchantId.trim(), from, to, storeId, limit: lim, sortBy });
  }

  /** 區間內按日彙總；query from、to、storeId? */
  @Get('daily')
  daily(
    @Query('merchantId') merchantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    if (!merchantId?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId required' });
    }
    return this.reports.getDaily({ merchantId: merchantId.trim(), from, to, storeId });
  }
}
