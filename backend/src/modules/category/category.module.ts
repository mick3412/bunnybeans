import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { CategoryController } from './interface/category.controller';
import { CategoryService } from './application/category.service';
import { CategoryRepository } from './infrastructure/category.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService],
})
export class CategoryModule {}
