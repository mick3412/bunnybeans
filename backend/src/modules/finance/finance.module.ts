import { Module } from '@nestjs/common';
import { FinanceController } from './interface/finance.controller';
import { FinanceService } from './application/finance.service';
import { FinanceRepository } from './infrastructure/finance.repository';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository],
  exports: [FinanceService],
})
export class FinanceModule {}

