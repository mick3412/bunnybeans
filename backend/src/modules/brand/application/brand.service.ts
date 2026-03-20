import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { throwBadRequest, throwNotFound, throwConflict } from '../../../shared/utils/throw-exceptions';
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
      throwNotFound('BRAND_NOT_FOUND', 'Brand not found');
    }
    const data: { code?: string; name?: string } = {};
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throwBadRequest('BRAND_NAME_REQUIRED', 'name cannot be empty');
      }
      data.name = n;
    }
    if (input.code !== undefined) {
      const raw = input.code.trim();
      if (!raw) {
        throwBadRequest('BRAND_CODE_REQUIRED', 'code cannot be empty');
      }
      const lower = raw.toLowerCase();
      if (lower !== existing.code.toLowerCase()) {
        if (!isValidCode(lower)) {
          throwBadRequest('BRAND_CODE_INVALID', 'code must match a-z0-9- (lowercase, no leading/trailing dash)');
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
        throwConflict('BRAND_CODE_CONFLICT', 'Brand code already exists');
      }
      throw e;
    }
  }

  async reorderBrands(ids: string[]) {
    const cleaned = ids.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!cleaned.length) {
      throwBadRequest('BRAND_REORDER_EMPTY', 'ids required');
    }
    const uniq = [...new Set(cleaned)];
    if (uniq.length !== cleaned.length) {
      throwBadRequest('BRAND_REORDER_DUPLICATE_IDS', 'duplicate ids');
    }
    const total = await this.repo.countAll();
    const count = await this.repo.countByIds(uniq);
    if (count !== uniq.length) {
      throwBadRequest('BRAND_NOT_FOUND', 'some ids not found');
    }
    if (uniq.length !== total) {
      throwBadRequest('BRAND_REORDER_INVALID', 'ids must include all brands');
    }
    await this.repo.reorder(uniq);
  }

  async deleteBrand(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throwNotFound('BRAND_NOT_FOUND', 'Brand not found');
    }
    const n = await this.repo.countProducts(id);
    if (n > 0) {
      throwConflict('BRAND_IN_USE', 'Brand still has products');
    }
    await this.repo.deleteById(id);
  }
}
