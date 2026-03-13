import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { BrandController } from './interface/brand.controller';
import { BrandService } from './application/brand.service';
import { BrandRepository } from './infrastructure/brand.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [BrandController],
  providers: [BrandService, BrandRepository],
  exports: [BrandService],
})
export class BrandModule {}
