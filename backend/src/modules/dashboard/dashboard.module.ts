import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { DashboardController } from './interface/dashboard.controller';
import { DashboardService } from './application/dashboard.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
