import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductTagRepository } from '../infrastructure/product-tag.repository';

@Injectable()
export class ProductTagService {
  constructor(private readonly repo: ProductTagRepository) {}

  list(merchantId: string) {
    const m = merchantId?.trim();
    if (!m) {
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'PRODUCT_TAG_MERCHANT_REQUIRED',
      });
    }
    return this.repo.findMany(m);
  }

  async create(input: { merchantId: string; name: string; code: string }) {
    const merchantId = input.merchantId?.trim();
    const name = input.name?.trim();
    const code = input.code?.trim();
    if (!merchantId) {
      throw new BadRequestException({
        message: 'merchantId is required',
        code: 'PRODUCT_TAG_MERCHANT_REQUIRED',
      });
    }
    if (!name) {
      throw new BadRequestException({
        message: 'name is required',
        code: 'PRODUCT_TAG_NAME_REQUIRED',
      });
    }
    if (!code) {
      throw new BadRequestException({
        message: 'code is required',
        code: 'PRODUCT_TAG_CODE_REQUIRED',
      });
    }
    try {
      const tag = await this.repo.create({ merchantId, name, code });
      return {
        id: tag.id,
        merchantId: tag.merchantId,
        name: tag.name,
        code: tag.code,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'ProductTag code already exists for this merchant',
          code: 'PRODUCT_TAG_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async update(id: string, input: { name?: string; code?: string }) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'ProductTag not found',
        code: 'PRODUCT_TAG_NOT_FOUND',
      });
    }
    const data: { name?: string; code?: string } = {};
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throw new BadRequestException({
          message: 'name cannot be empty',
          code: 'PRODUCT_TAG_NAME_REQUIRED',
        });
      }
      data.name = n;
    }
    if (input.code !== undefined) {
      const c = input.code.trim();
      if (!c) {
        throw new BadRequestException({
          message: 'code cannot be empty',
          code: 'PRODUCT_TAG_CODE_REQUIRED',
        });
      }
      data.code = c;
    }
    if (!Object.keys(data).length) {
      return {
        id: existing.id,
        merchantId: existing.merchantId,
        name: existing.name,
        code: existing.code,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }
    try {
      const tag = await this.repo.update(id, data);
      return {
        id: tag.id,
        merchantId: tag.merchantId,
        name: tag.name,
        code: tag.code,
        createdAt: tag.createdAt.toISOString(),
        updatedAt: tag.updatedAt.toISOString(),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'ProductTag code already exists for this merchant',
          code: 'PRODUCT_TAG_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'ProductTag not found',
        code: 'PRODUCT_TAG_NOT_FOUND',
      });
    }
    await this.repo.delete(id);
    return { success: true };
  }
}
