import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { PromotionController } from './interface/promotion.controller';
import { PromotionService } from './application/promotion.service';
import { PromotionRepository } from './infrastructure/promotion.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionRepository],
  exports: [PromotionService],
})
export class PromotionModule {}
