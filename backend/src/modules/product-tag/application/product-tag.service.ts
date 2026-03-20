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
import { ProductTagRepository } from '../infrastructure/product-tag.repository';

@Injectable()
export class ProductTagService {
  constructor(private readonly repo: ProductTagRepository) {}

  list(merchantId: string) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('PRODUCT_TAG_MERCHANT_REQUIRED', 'merchantId is required');
    }
    return this.repo.findMany(m);
  }

  async create(input: { merchantId: string; name: string; code?: string }) {
    const merchantId = input.merchantId?.trim();
    if (!merchantId) {
      throwBadRequest('PRODUCT_TAG_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const tag = await createMasterWithCode<{ merchantId: string }, Awaited<ReturnType<ProductTagRepository['create']>>>({
      name: input.name,
      code: input.code,
      findExistingCodes: () => this.repo.findCodes(merchantId),
      create: (data) => this.repo.create(data),
      extra: { merchantId },
      conflictCode: 'PRODUCT_TAG_CODE_CONFLICT',
      conflictMessage: 'ProductTag code already exists for this merchant',
      nameRequiredCode: 'PRODUCT_TAG_NAME_REQUIRED',
      codeInvalidCode: 'PRODUCT_TAG_CODE_INVALID',
    });
    return {
      id: tag.id,
      merchantId: tag.merchantId,
      name: tag.name,
      code: tag.code,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }

  async update(id: string, input: { name?: string; code?: string }) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throwNotFound('PRODUCT_TAG_NOT_FOUND', 'ProductTag not found');
    }
    const data: { name?: string; code?: string } = {};
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throwBadRequest('PRODUCT_TAG_NAME_REQUIRED', 'name cannot be empty');
      }
      data.name = n;
    }
    if (input.code !== undefined) {
      const raw = input.code.trim();
      if (!raw) {
        throwBadRequest('PRODUCT_TAG_CODE_REQUIRED', 'code cannot be empty');
      }
      const lower = raw.toLowerCase();
      if (lower !== existing.code.toLowerCase()) {
        if (!isValidCode(lower)) {
          throwBadRequest('PRODUCT_TAG_CODE_INVALID', 'code must match a-z0-9- (lowercase, no leading/trailing dash)');
        }
        const existingCodes = await this.repo.findCodes(existing.merchantId);
        const others = existingCodes.filter((c) => c.toLowerCase() !== existing.code.toLowerCase());
        data.code = dedupeCode(lower, others);
      }
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
        throwConflict('PRODUCT_TAG_CODE_CONFLICT', 'ProductTag code already exists for this merchant');
      }
      throw e;
    }
  }

  async reorder(merchantId: string, ids: string[]) {
    const m = merchantId?.trim();
    if (!m) {
      throwBadRequest('PRODUCT_TAG_MERCHANT_REQUIRED', 'merchantId is required');
    }
    const cleaned = ids.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!cleaned.length) {
      throwBadRequest('PRODUCT_TAG_REORDER_EMPTY', 'ids required');
    }
    const uniq = [...new Set(cleaned)];
    if (uniq.length !== cleaned.length) {
      throwBadRequest('PRODUCT_TAG_REORDER_DUPLICATE_IDS', 'duplicate ids');
    }
    const total = await this.repo.countByMerchant(m);
    const count = await this.repo.countByIdsAndMerchant(m, uniq);
    if (count !== uniq.length) {
      throwBadRequest('PRODUCT_TAG_NOT_FOUND', 'some ids not found for merchant');
    }
    if (uniq.length !== total) {
      throwBadRequest('PRODUCT_TAG_REORDER_INVALID', 'ids must include all product tags for merchant');
    }
    await this.repo.reorder(m, uniq);
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throwNotFound('PRODUCT_TAG_NOT_FOUND', 'ProductTag not found');
    }
    await this.repo.delete(id);
    return { success: true };
  }
}
