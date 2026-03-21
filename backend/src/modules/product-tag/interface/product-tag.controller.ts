import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { ProductTagService } from '../application/product-tag.service';

@Controller('product-tags')
export class ProductTagController {
  constructor(private readonly service: ProductTagService) {}

  @Get()
  list(@Query('merchantId') merchantId: string) {
    return this.service.list(merchantId);
  }

  @Get('for-pos-discount')
  listForPosDiscount(@Query('merchantId') merchantId: string) {
    return this.service.listForPosDiscount(merchantId);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(
    @Body()
    body: {
      merchantId: string;
      name: string;
      code?: string;
      showInPosDiscount?: boolean;
      autoCondition?: Prisma.InputJsonValue;
    },
  ) {
    return this.service.create(body);
  }

  @Patch('reorder')
  @UseGuards(AdminApiKeyGuard)
  reorder(@Body() body: { merchantId: string; ids: string[] }) {
    return this.service.reorder(body.merchantId ?? '', body.ids ?? []);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      code?: string;
      showInPosDiscount?: boolean;
      autoCondition?: Prisma.InputJsonValue;
    },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.delete(id);
  }
}
