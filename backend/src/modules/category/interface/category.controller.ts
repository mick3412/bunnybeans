import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { CategoryService } from '../application/category.service';

@Controller('categories')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Get('enriched')
  listEnriched() {
    return this.service.listCategoriesEnriched();
  }

  @Get()
  list() {
    return this.service.listCategories();
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(@Body() body: { code: string; name: string }) {
    return this.service.createCategory(body);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body() body: { code?: string; name?: string },
  ) {
    return this.service.updateCategory(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.deleteCategory(id);
  }
}
