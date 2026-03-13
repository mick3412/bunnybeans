import { Controller, Get } from '@nestjs/common';
import { BrandService } from '../application/brand.service';

@Controller('brands')
export class BrandController {
  constructor(private readonly service: BrandService) {}

  @Get()
  list() {
    return this.service.listBrands();
  }
}
