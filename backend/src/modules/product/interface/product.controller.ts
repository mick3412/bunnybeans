import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
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
    @Query('minDaysUntilExpiry') minDaysUntilExpiry?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    let minDays: number | undefined;
    if (minDaysUntilExpiry?.trim()) {
      const n = parseInt(minDaysUntilExpiry.trim(), 10);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException({
          message: 'minDaysUntilExpiry must be a non-negative integer',
          code: 'PRODUCT_FILTER_INVALID',
        });
      }
      minDays = n;
    }
    const hasFilter =
      search || sku || categoryId || brandId || tag || minDays !== undefined;
    return this.service.listProducts(
      hasFilter
        ? {
            search: search?.trim() || undefined,
            sku: sku?.trim() || undefined,
            categoryId: categoryId?.trim() || undefined,
            brandId: brandId?.trim() || undefined,
            tag: tag?.trim() || undefined,
            minDaysUntilExpiry: minDays,
          }
        : undefined,
      {
        page: page != null ? parseInt(page, 10) : undefined,
        pageSize: pageSize != null ? parseInt(pageSize, 10) : undefined,
      },
    );
  }

  /** CSV 匯出：與 list 同篩選；UTF-8 BOM；Admin Key；上限 1 萬列 */
  @Get('export')
  @UseGuards(AdminApiKeyGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  async export(
    @Query('search') search?: string,
    @Query('sku') sku?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('tag') tag?: string,
    @Query('minDaysUntilExpiry') minDaysUntilExpiry?: string,
    @Res({ passthrough: false }) res?: Response,
  ) {
    let minDays: number | undefined;
    if (minDaysUntilExpiry?.trim()) {
      const n = parseInt(minDaysUntilExpiry.trim(), 10);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException({
          message: 'minDaysUntilExpiry must be a non-negative integer',
          code: 'PRODUCT_FILTER_INVALID',
        });
      }
      minDays = n;
    }
    const csv = await this.service.exportProductsCsv({
      search: search?.trim() || undefined,
      sku: sku?.trim() || undefined,
      categoryId: categoryId?.trim() || undefined,
      brandId: brandId?.trim() || undefined,
      tag: tag?.trim() || undefined,
      minDaysUntilExpiry: minDays,
    });
    res!.send('\uFEFF' + csv);
  }

  /** 條碼專用查詢（精確比對）；需放在 :id 之前避免路由衝突 */
  @Get('search-barcode')
  searchBarcode(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : undefined;
    return this.service.searchBarcode(q ?? '', lim);
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @Query('includeBalances') includeBalances?: string,
  ) {
    return this.service.getProduct(id, {
      includeBalances: includeBalances === 'true' || includeBalances === '1',
    });
  }

  @Post('import')
  @UseGuards(AdminApiKeyGuard)
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        message: 'multipart field file (CSV) required',
        code: 'PRODUCT_IMPORT_FILE_REQUIRED',
      });
    }
    return this.service.importFromCsvBuffer(file.buffer);
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
      specCapacity?: string | null;
      specStyle?: string | null;
      specWeight?: string | null;
      expiryDescription?: string | null;
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

  @Patch('batch-price')
  @UseGuards(AdminApiKeyGuard)
  batchPrice(
    @Body()
    body: { productIds: string[]; salePrice: string | number },
  ) {
    return this.service.batchUpdatePrice(
      body.productIds ?? [],
      body.salePrice ?? 0,
    );
  }

  @Patch('batch-tags')
  @UseGuards(AdminApiKeyGuard)
  batchTags(
    @Body()
    body: {
      productIds: string[];
      tags: string[];
      operation?: 'add' | 'set';
    },
  ) {
    if (body.operation != null && body.operation !== 'add' && body.operation !== 'set') {
      throw new BadRequestException({
        message: 'operation must be add or set',
        code: 'PRODUCT_BATCH_INVALID',
      });
    }
    return this.service.batchUpdateTags(
      body.productIds ?? [],
      body.tags ?? [],
      body.operation ?? 'add',
    );
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
      specCapacity?: string | null;
      specStyle?: string | null;
      specWeight?: string | null;
      expiryDescription?: string | null;
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
