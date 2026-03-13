import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductService } from '../application/product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('sku') sku?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const hasFilter = search || sku || categoryId;
    return this.service.listProducts(
      hasFilter
        ? {
            search: search?.trim() || undefined,
            sku: sku?.trim() || undefined,
            categoryId: categoryId?.trim() || undefined,
          }
        : undefined,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getProduct(id);
  }

  @Post()
  create(
    @Body()
    body: {
      sku: string;
      name: string;
    },
  ) {
    return this.service.createProduct(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      sku?: string;
      name?: string;
    },
  ) {
    return this.service.updateProduct(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.deleteProduct(id);
  }
}

