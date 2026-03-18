import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { OpsModule } from '../ops/ops.module';
import { FinanceController } from './interface/finance.controller';
import { FinanceService } from './application/finance.service';
import { FinanceRepository } from './infrastructure/finance.repository';

@Module({
  imports: [DatabaseModule, forwardRef(() => OpsModule)],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository],
  exports: [FinanceService],
})
export class FinanceModule {}

