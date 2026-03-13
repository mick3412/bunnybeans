import { Module } from '@nestjs/common';
import { MerchantController } from './interface/merchant.controller';
import { MerchantService } from './application/merchant.service';
import { MerchantRepository } from './infrastructure/merchant.repository';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, MerchantRepository],
  exports: [MerchantService],
})
export class MerchantModule {}


