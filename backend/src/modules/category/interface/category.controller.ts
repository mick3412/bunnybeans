import { Controller, Get } from '@nestjs/common';
import { CategoryService } from '../application/category.service';

@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get()
  list() {
    return this.service.listCategories();
  }
}
