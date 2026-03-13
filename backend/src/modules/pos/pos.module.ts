import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { PosController } from './interface/pos.controller';
import { PosService } from './application/pos.service';
import { PosRepository } from './infrastructure/pos.repository';

@Module({
  imports: [InventoryModule, FinanceModule],
  controllers: [PosController],
  providers: [PosService, PosRepository],
  exports: [PosService],
})
export class PosModule {}

