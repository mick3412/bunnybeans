import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { InventoryController } from './interface/inventory.controller';
import { InventoryService } from './application/inventory.service';
import { InventoryRepository } from './infrastructure/inventory.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}

