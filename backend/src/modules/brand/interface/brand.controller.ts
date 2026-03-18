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
import { BrandService } from '../application/brand.service';

@Controller('brands')
export class BrandController {
  constructor(private readonly service: BrandService) {}

  @Get()
  list() {
    return this.service.listBrands();
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  create(@Body() body: { code: string; name: string }) {
    return this.service.createBrand(body);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  update(
    @Param('id') id: string,
    @Body() body: { code?: string; name?: string },
  ) {
    return this.service.updateBrand(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.deleteBrand(id);
  }
}
