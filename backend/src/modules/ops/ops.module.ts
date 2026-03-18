import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { CrmModule } from '../crm/crm.module';
import { FinanceModule } from '../finance/finance.module';
import { OpsService } from './application/ops.service';
import { OpsController } from './interface/ops.controller';

@Module({
  imports: [DatabaseModule, forwardRef(() => CrmModule), forwardRef(() => FinanceModule)],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
