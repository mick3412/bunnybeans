import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { PurchaseReportsService } from '../application/purchase-reports.service';

@Controller('purchase/reports')
@UseGuards(AdminApiKeyGuard)
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
