import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './shared/database/database.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PosModule } from './modules/pos/pos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    MerchantModule,
    CategoryModule,
    ProductModule,
    InventoryModule,
    FinanceModule,
    PosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

