import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { OpsModule } from '../ops/ops.module';
import { CrmController } from './interface/crm.controller';
import { SegmentController } from './interface/segment.controller';
import { SegmentService } from './application/segment.service';
import { TierRuleService } from './application/tier-rule.service';
import { CrmJobService } from './application/crm-job.service';
import { DispatchRuleService } from './application/dispatch-rule.service';
import { DispatchRuleRunnerService } from './application/dispatch-rule-runner.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => OpsModule)],
  controllers: [CrmController, SegmentController],
  providers: [SegmentService, TierRuleService, CrmJobService, DispatchRuleService, DispatchRuleRunnerService],
  exports: [DispatchRuleRunnerService],
})
export class CrmModule {}
