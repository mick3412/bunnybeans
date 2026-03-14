import { Controller, Get } from '@nestjs/common';
import { PosReportsService } from '../application/pos-reports.service';

@Controller('pos/reports')
export class PosReportsController {
  constructor(private readonly reports: PosReportsService) {}

  /** 本日彙總：營收、單數、均單、退款 */
  @Get('summary')
  summary() {
    return this.reports.todaySummary();
  }
}
