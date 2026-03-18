import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OpsService } from '../application/ops.service';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';

@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  /** GET /ops/jobs/status — 各定時 job 最近一次執行時間與成功與否（運維用） */
  @Get('jobs/status')
  getJobsStatus() {
    return this.opsService.getStatus();
  }

  /** GET /ops/jobs — OpsJobRunLog 列表，分頁與 kind 篩選 */
  @Get('jobs')
  listJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.opsService.listJobs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      kind,
      from,
      to,
    });
  }

  /** GET /ops/references/resolve — 解析跨模組 referenceId */
  @Get('references/resolve')
  resolveReference(@Query('referenceId') referenceId?: string) {
    return this.opsService.resolveReference(referenceId ?? '');
  }

  /** POST /ops/reports/click-audit — 報表穿透點擊審計（Admin） */
  @Post('reports/click-audit')
  @UseGuards(AdminApiKeyGuard)
  reportClickAudit(
    @Body()
    body: {
      merchantId?: string;
      source: string;
      field?: string;
      referenceId: string;
    },
  ) {
    return this.opsService.recordReportClickAudit({
      merchantId: body.merchantId,
      source: body.source,
      field: body.field,
      referenceId: body.referenceId,
    });
  }

  /** POST /ops/jobs/run — 手動補跑指定 job（Admin） */
  @Post('jobs/run')
  @UseGuards(AdminApiKeyGuard)
  runJob(
    @Body()
    body: {
      kind: 'crm-run-scheduled' | 'finance-snapshot';
      asOfDate?: string;
      snapshotType?: 'daily' | 'monthly';
    },
  ) {
    return this.opsService.runJob(body ?? { kind: 'crm-run-scheduled' });
  }
}
