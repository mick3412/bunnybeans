import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { LoyaltyService } from './application/loyalty.service';
import { LoyaltyController } from './interface/loyalty.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
