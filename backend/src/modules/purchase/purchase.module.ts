import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SupplierService } from './application/supplier.service';
import { PurchaseOrderService } from './application/purchase-order.service';
import { ReceivingNoteService } from './application/receiving-note.service';
import { SupplierController } from './interface/supplier.controller';
import { PurchaseOrderController } from './interface/purchase-order.controller';
import { ReceivingNoteController } from './interface/receiving-note.controller';

@Module({
  imports: [DatabaseModule, InventoryModule, FinanceModule],
  controllers: [SupplierController, PurchaseOrderController, ReceivingNoteController],
  providers: [SupplierService, PurchaseOrderService, ReceivingNoteService],
})
export class PurchaseModule {}
