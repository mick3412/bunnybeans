import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { ProductController } from './interface/product.controller';
import { ProductService } from './application/product.service';
import { ProductRepository } from './infrastructure/product.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductController],
  providers: [ProductService, ProductRepository],
  exports: [ProductService],
})
export class ProductModule {}


