import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MerchantService } from '../../merchant/application/merchant.service';
import { PosReportsService } from '../application/pos-reports.service';

@Controller('pos/reports')
export class PosReportsController {
  constructor(
    private readonly reports: PosReportsService,
    private readonly merchantService: MerchantService,
  ) {}

  private async resolveMerchantId(merchantId?: string): Promise<string> {
    const trimmed = merchantId?.trim();
    if (trimmed) return trimmed;
    try {
      const current = await this.merchantService.getCurrentMerchant();
      return current.id;
    } catch {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'merchantId required' });
    }
  }

  /**
   * 區間彙總：query preset（today｜last7d｜last30d｜currentMonth｜last60d｜lastHalfYear）或 from／to；storeId 選填。
   * 回傳 period、totalRevenue、ordersCount、avgOrder、refundsCount、refundsTotal、byPaymentMethod、byCategory。
   */
  @Get('summary')
  async summary(
    @Query('merchantId') merchantId?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    const resolved = await this.resolveMerchantId(merchantId);
    return this.reports.summary({ merchantId: resolved, preset, from, to, storeId });
  }

  /** 區間內銷售品項排行；query from、to、storeId?、limit（預設 20）、sortBy=quantity｜revenue */
  @Get('top-items')
  async topItems(
    @Query('merchantId') merchantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'quantity' | 'revenue',
  ) {
    const resolved = await this.resolveMerchantId(merchantId);
    const lim = limit ? parseInt(limit, 10) : undefined;
    return this.reports.getTopItems({ merchantId: resolved, from, to, storeId, limit: lim, sortBy });
  }

  /** 區間內按日／週／月彙總；query from、to、storeId?、groupBy?（day｜week｜month） */
  @Get('daily')
  async daily(
    @Query('merchantId') merchantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const resolved = await this.resolveMerchantId(merchantId);
    return this.reports.getDaily({ merchantId: resolved, from, to, storeId, groupBy });
  }

  /** 客單價分布；query 同 summary */
  @Get('order-value-distribution')
  async orderValueDistribution(
    @Query('merchantId') merchantId?: string,
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
  ) {
    const resolved = await this.resolveMerchantId(merchantId);
    return this.reports.getOrderValueDistribution({
      merchantId: resolved,
      preset,
      from,
      to,
      storeId,
    });
  }
}
