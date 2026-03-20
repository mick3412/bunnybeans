import { Controller, Get, Query } from '@nestjs/common';
import { PurchaseReportsService } from '../application/purchase-reports.service';

@Controller('purchase/reports')
export class PurchaseReportsController {
  constructor(private readonly svc: PurchaseReportsService) {}

  @Get('supplier-rankings')
  supplierRankings(
    @Query('merchantId') merchantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.supplierRankings({ merchantId, from, to });
  }
}
