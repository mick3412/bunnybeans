import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrandRepository } from '../infrastructure/brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly repo: BrandRepository) {}

  listBrands() {
    return this.repo.findAll();
  }

  async createBrand(input: { code: string; name: string }) {
    const code = input.code?.trim();
    const name = input.name?.trim();
    if (!code) {
      throw new BadRequestException({
        message: 'code is required',
        code: 'BRAND_CODE_REQUIRED',
      });
    }
    if (!name) {
      throw new BadRequestException({
        message: 'name is required',
        code: 'BRAND_NAME_REQUIRED',
      });
    }
    try {
      return await this.repo.create({ code, name });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Brand code already exists',
          code: 'BRAND_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async updateBrand(id: string, input: { code?: string; name?: string }) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'Brand not found',
        code: 'BRAND_NOT_FOUND',
      });
    }
    const data: { code?: string; name?: string } = {};
    if (input.code !== undefined) {
      const c = input.code.trim();
      if (!c) {
        throw new BadRequestException({
          message: 'code cannot be empty',
          code: 'BRAND_CODE_REQUIRED',
        });
      }
      data.code = c;
    }
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throw new BadRequestException({
          message: 'name cannot be empty',
          code: 'BRAND_NAME_REQUIRED',
        });
      }
      data.name = n;
    }
    if (!Object.keys(data).length) return existing;
    try {
      return await this.repo.update(id, data);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Brand code already exists',
          code: 'BRAND_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async deleteBrand(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'Brand not found',
        code: 'BRAND_NOT_FOUND',
      });
    }
    const n = await this.repo.countProducts(id);
    if (n > 0) {
      throw new ConflictException({
        message: 'Brand still has products',
        code: 'BRAND_IN_USE',
      });
    }
    await this.repo.deleteById(id);
  }
}
