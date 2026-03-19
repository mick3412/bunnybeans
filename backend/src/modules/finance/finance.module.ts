import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { MerchantModule } from '../merchant/merchant.module';
import { OpsModule } from '../ops/ops.module';
import { FinanceController } from './interface/finance.controller';
import { FinanceService } from './application/finance.service';
import { FinanceRepository } from './infrastructure/finance.repository';

@Module({
  imports: [DatabaseModule, MerchantModule, forwardRef(() => OpsModule)],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository],
  exports: [FinanceService],
})
export class FinanceModule {}

