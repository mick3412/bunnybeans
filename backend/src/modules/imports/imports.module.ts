import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductModule } from '../product/product.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ImportsController } from './interface/imports.controller';
import { ImportsService } from './application/imports.service';

@Module({
  imports: [DatabaseModule, ProductModule, InventoryModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
