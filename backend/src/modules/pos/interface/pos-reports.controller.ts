import { Controller, Get, Query } from '@nestjs/common';
import { MerchantService } from '../../merchant/application/merchant.service';
import { PosReportsQueryDto, MarketBasketQueryDto } from '../dto/pos-reports-query.dto';
import { throwBadRequest } from '../../../shared/utils/throw-exceptions';
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
      throwBadRequest('VALIDATION_ERROR', 'merchantId required');
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

  /** 區間內銷售品項排行；query from、to、storeId?、limit（預設 20，上限 100）、sortBy=quantity｜revenue */
  @Get('top-items')
  async topItems(@Query() query: PosReportsQueryDto) {
    const resolved = await this.resolveMerchantId(query.merchantId);
    return this.reports.getTopItems({
      merchantId: resolved,
      from: query.from,
      to: query.to,
      storeId: query.storeId,
      limit: query.limit,
      sortBy: query.sortBy,
    });
  }

  /** 區間內按日／週／月／時段彙總；query from、to、storeId?、groupBy?（day｜week｜month｜hour） */
  @Get('daily')
  async daily(
    @Query('merchantId') merchantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('storeId') storeId?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month' | 'hour',
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

  /** 共購分析（Market Basket）；promoFilter 可區分有/無促銷 */
  @Get('market-basket')
  async marketBasket(@Query() query: MarketBasketQueryDto) {
    const resolved = await this.resolveMerchantId(query.merchantId);
    return this.reports.getMarketBasket({
      merchantId: resolved,
      preset: query.preset,
      from: query.from,
      to: query.to,
      storeId: query.storeId,
      promoFilter: query.promoFilter,
      limit: query.limit,
      minSupport: query.minSupport,
    });
  }
}
