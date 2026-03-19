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
import { AdminApiKeyGuard } from '../../../shared/guards/admin-api-key.guard';
import { ProductTagService } from '../application/product-tag.service';

@Controller('product-tags')
export class ProductTagController {
  constructor(private readonly service: ProductTagService) {}

  @Get()
  list(@Query('merchantId') merchantId: string) {
    return this.service.list(merchantId);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(
    @Body() body: { merchantId: string; name: string; code?: string },
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; code?: string },
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
