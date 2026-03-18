import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductTagController } from './interface/product-tag.controller';
import { ProductTagService } from './application/product-tag.service';
import { ProductTagRepository } from './infrastructure/product-tag.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductTagController],
  providers: [ProductTagService, ProductTagRepository],
  exports: [ProductTagService],
})
export class ProductTagModule {}
