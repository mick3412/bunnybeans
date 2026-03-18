import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { OpsService } from '../../ops/application/ops.service';
import { TierRuleService } from '../application/tier-rule.service';
import { CrmJobService } from '../application/crm-job.service';
import { DispatchRuleService } from '../application/dispatch-rule.service';
import { DispatchRuleRunnerService } from '../application/dispatch-rule-runner.service';

/** 階段 E：TierRule CRUD、recalc-tiers；階段 G：行銷 job、發券規則常駐 */
@Controller('crm')
export class CrmController {
  constructor(
    private readonly tierRuleService: TierRuleService,
    private readonly crmJobService: CrmJobService,
    private readonly dispatchRuleService: DispatchRuleService,
    private readonly dispatchRuleRunner: DispatchRuleRunnerService,
    private readonly opsService: OpsService,
  ) {}

  @Get('tier-rules')
  @UseGuards(AdminApiKeyGuard)
  listTierRules(@Query('merchantId') merchantId: string) {
    return this.tierRuleService.list(merchantId?.trim() ?? '');
  }

  @Post('tier-rules')
  @UseGuards(AdminApiKeyGuard)
  createTierRule(
    @Query('merchantId') merchantId: string,
    @Body() body: { name: string; ruleType: string; threshold: number; targetLevel: string; lookbackDays?: number },
  ) {
    return this.tierRuleService.create(merchantId?.trim() ?? '', body);
  }

  @Patch('tier-rules/:id')
  @UseGuards(AdminApiKeyGuard)
  updateTierRule(
    @Query('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; threshold: number; targetLevel: string; lookbackDays: number }>,
  ) {
    return this.tierRuleService.update(merchantId?.trim() ?? '', id, body);
  }

  @Delete('tier-rules/:id')
  @UseGuards(AdminApiKeyGuard)
  deleteTierRule(@Query('merchantId') merchantId: string, @Param('id') id: string) {
    return this.tierRuleService.delete(merchantId?.trim() ?? '', id);
  }

  /** POST /crm/recalc-tiers — 批次重算會員等級（依 TierRule SPEND_SUM） */
  @Post('recalc-tiers')
  @UseGuards(AdminApiKeyGuard)
  recalcTiers(@Body() body: { merchantId?: string }) {
    const merchantId = body?.merchantId?.trim();
    if (!merchantId) {
      throw new BadRequestException({ code: 'CRM_RECALC_MERCHANT_REQUIRED', message: 'merchantId is required' });
    }
    return this.tierRuleService.recalcTiers(merchantId);
  }

  /** POST /crm/jobs/run-scheduled — 執行排程發券（cron 或手動）；掃 enabled 規則並觸發 job、更新 nextRunAt */
  @Post('jobs/run-scheduled')
  @UseGuards(AdminApiKeyGuard)
  async runScheduledJobs() {
    const result = await this.dispatchRuleRunner.runScheduled();
    await this.opsService.recordRun('crm-run-scheduled', result.errors.length === 0, result.errors.length ? result.errors.join('; ') : undefined);
    return result;
  }

  /** POST /crm/jobs/:kind — 階段 G 分群發券（segment-coupon｜birthday-coupon｜repurchase-coupon）；body merchantId、segmentId、couponId|couponCode */
  @Post('jobs/:kind')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(202)
  createJob(
    @Param('kind') kind: string,
    @Body() body: { merchantId?: string; segmentId?: string; couponId?: string; couponCode?: string },
  ) {
    return this.crmJobService.createJob(kind, body ?? {});
  }

  /** GET /crm/jobs/:id — job 狀態與 result */
  @Get('jobs/:id')
  @UseGuards(AdminApiKeyGuard)
  getJob(@Param('id') id: string) {
    return this.crmJobService.getJob(id);
  }

  /** GET /crm/jobs — 歷史列表（分頁、kind、from/to） */
  @Get('jobs')
  @UseGuards(AdminApiKeyGuard)
  listJobs(
    @Query('merchantId') merchantId?: string,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.crmJobService.listJobs({
      merchantId,
      kind,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  /** GET /crm/dispatch-rules — 發券規則列表 */
  @Get('dispatch-rules')
  @UseGuards(AdminApiKeyGuard)
  listDispatchRules(@Query('merchantId') merchantId: string, @Query('enabled') enabled?: string) {
    const en = enabled === 'true' ? true : enabled === 'false' ? false : undefined;
    return this.dispatchRuleService.list(merchantId?.trim() ?? '', en);
  }

  @Post('dispatch-rules')
  @UseGuards(AdminApiKeyGuard)
  createDispatchRule(
    @Query('merchantId') merchantId: string,
    @Body()
    body: {
      name: string;
      segmentId: string;
      couponId: string;
      enabled?: boolean;
      scheduleType: string;
      cronExpr?: string;
      nextRunAt?: string;
    },
  ) {
    return this.dispatchRuleService.create(merchantId?.trim() ?? '', body);
  }

  @Patch('dispatch-rules/:id')
  @UseGuards(AdminApiKeyGuard)
  updateDispatchRule(
    @Query('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; segmentId: string; couponId: string; enabled: boolean; scheduleType: string; cronExpr: string | null; nextRunAt: string | null }>,
  ) {
    return this.dispatchRuleService.update(merchantId?.trim() ?? '', id, body);
  }

  @Delete('dispatch-rules/:id')
  @UseGuards(AdminApiKeyGuard)
  deleteDispatchRule(@Query('merchantId') merchantId: string, @Param('id') id: string) {
    return this.dispatchRuleService.delete(merchantId?.trim() ?? '', id);
  }
}
