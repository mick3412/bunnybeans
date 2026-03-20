import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { MerchantModule } from '../merchant/merchant.module';
import { ProductModule } from '../product/product.module';
import { PromotionModule } from '../promotion/promotion.module';
import { PosController } from './interface/pos.controller';
import { PosProductsController } from './interface/pos-products.controller';
import { PosReportsController } from './interface/pos-reports.controller';
import { PosPromotionsController } from './interface/pos-promotions.controller';
import { PosService } from './application/pos.service';
import { PosReportsService } from './application/pos-reports.service';
import { PosRepository } from './infrastructure/pos.repository';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    MerchantModule,
    ProductModule,
    FinanceModule,
    PromotionModule,
    LoyaltyModule,
  ],
  controllers: [PosController, PosProductsController, PosReportsController, PosPromotionsController],
  providers: [PosService, PosReportsService, PosRepository],
  exports: [PosService],
})
export class PosModule {}

