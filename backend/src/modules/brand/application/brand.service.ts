import { Injectable } from '@nestjs/common';
import { BrandRepository } from '../infrastructure/brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly repo: BrandRepository) {}

  listBrands() {
    return this.repo.findAll();
  }
}
