import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { ProductService } from '../application/product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('sku') sku?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('tag') tag?: string,
  ) {
    const hasFilter =
      search || sku || categoryId || brandId || tag;
    return this.service.listProducts(
      hasFilter
        ? {
            search: search?.trim() || undefined,
            sku: sku?.trim() || undefined,
            categoryId: categoryId?.trim() || undefined,
            brandId: brandId?.trim() || undefined,
            tag: tag?.trim() || undefined,
          }
        : undefined,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getProduct(id);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(
    @Body()
    body: {
      sku: string;
      name: string;
      description?: string | null;
      specSize?: string | null;
      specColor?: string | null;
      weightGrams?: number | null;
      listPrice?: string | number | null;
      salePrice?: string | number | null;
      costPrice?: string | number | null;
      categoryId?: string | null;
      brandId?: string | null;
      tags?: string[];
    },
  ) {
    return this.service.createProduct(body);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      sku?: string;
      name?: string;
      description?: string | null;
      specSize?: string | null;
      specColor?: string | null;
      weightGrams?: number | null;
      listPrice?: string | number | null;
      salePrice?: string | number | null;
      costPrice?: string | number | null;
      categoryId?: string | null;
      brandId?: string | null;
      tags?: string[];
    },
  ) {
    return this.service.updateProduct(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  delete(@Param('id') id: string) {
    return this.service.deleteProduct(id);
  }
}
