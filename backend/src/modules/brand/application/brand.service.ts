import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dedupeCode, isValidCode, resolveCode } from '../../../shared/utils/canonical-code';
import { createMasterWithCode } from '../../../shared/utils/create-master-with-code';
import { BrandRepository } from '../infrastructure/brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly repo: BrandRepository) {}

  listBrands() {
    return this.repo.findAll();
  }

  async createBrand(input: { code?: string; name: string }) {
    return createMasterWithCode<Record<string, never>, Awaited<ReturnType<BrandRepository['create']>>>({
      name: input.name,
      code: input.code,
      findExistingCodes: () => this.repo.findCodes(),
      create: (data) => this.repo.create(data),
      conflictCode: 'BRAND_CODE_CONFLICT',
      conflictMessage: 'Brand code already exists',
      nameRequiredCode: 'BRAND_NAME_REQUIRED',
      codeInvalidCode: 'BRAND_CODE_INVALID',
    });
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
    if (input.code !== undefined) {
      const raw = input.code.trim();
      if (!raw) {
        throw new BadRequestException({
          message: 'code cannot be empty',
          code: 'BRAND_CODE_REQUIRED',
        });
      }
      const lower = raw.toLowerCase();
      if (lower !== existing.code.toLowerCase()) {
        if (!isValidCode(lower)) {
          throw new BadRequestException({
            message: 'code must match a-z0-9- (lowercase, no leading/trailing dash)',
            code: 'BRAND_CODE_INVALID',
          });
        }
        const existingCodes = await this.repo.findCodes();
        const others = existingCodes.filter((c) => c.toLowerCase() !== existing.code.toLowerCase());
        data.code = dedupeCode(lower, others);
      }
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

  async reorderBrands(ids: string[]) {
    const cleaned = ids.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!cleaned.length) {
      throw new BadRequestException({
        message: 'ids required',
        code: 'BRAND_REORDER_EMPTY',
      });
    }
    const uniq = [...new Set(cleaned)];
    if (uniq.length !== cleaned.length) {
      throw new BadRequestException({
        message: 'duplicate ids',
        code: 'BRAND_REORDER_DUPLICATE_IDS',
      });
    }
    const total = await this.repo.countAll();
    const count = await this.repo.countByIds(uniq);
    if (count !== uniq.length) {
      throw new BadRequestException({
        message: 'some ids not found',
        code: 'BRAND_NOT_FOUND',
      });
    }
    if (uniq.length !== total) {
      throw new BadRequestException({
        message: 'ids must include all brands',
        code: 'BRAND_REORDER_INVALID',
      });
    }
    await this.repo.reorder(uniq);
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
