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
import { CategoryRepository } from '../infrastructure/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  listCategories() {
    return this.repo.findAll();
  }

  /** 每分類：商品數、品牌 code 去重、tags 去重（供後台報表／篩選） */
  async listCategoriesEnriched() {
    const categories = await this.repo.findAll();
    const products = await this.repo.productsForEnriched();
    const byCat = new Map<
      string,
      { count: number; brandCodes: Set<string>; tags: Set<string> }
    >();
    for (const c of categories) {
      byCat.set(c.id, { count: 0, brandCodes: new Set(), tags: new Set() });
    }
    for (const p of products) {
      if (!p.categoryId || !byCat.has(p.categoryId)) continue;
      const agg = byCat.get(p.categoryId)!;
      agg.count += 1;
      if (p.brand?.code) agg.brandCodes.add(p.brand.code);
      const tagArr = Array.isArray(p.tags)
        ? (p.tags as string[])
        : typeof p.tags === 'string'
          ? []
          : (p.tags as unknown as string[]) ?? [];
      for (const t of tagArr) {
        if (typeof t === 'string' && t.trim()) agg.tags.add(t.trim());
      }
    }
    return categories.map((c) => {
      const agg = byCat.get(c.id)!;
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        productCount: agg.count,
        brandCodes: [...agg.brandCodes].sort(),
        tags: [...agg.tags].sort(),
      };
    });
  }

  async createCategory(input: { code?: string; name: string }) {
    return createMasterWithCode<Record<string, never>, Awaited<ReturnType<CategoryRepository['create']>>>({
      name: input.name,
      code: input.code,
      findExistingCodes: () => this.repo.findCodes(),
      create: (data) => this.repo.create(data),
      conflictCode: 'CATEGORY_CODE_CONFLICT',
      conflictMessage: 'Category code already exists',
      nameRequiredCode: 'CATEGORY_NAME_REQUIRED',
      codeInvalidCode: 'CATEGORY_CODE_INVALID',
    });
  }

  async updateCategory(
    id: string,
    input: { code?: string; name?: string },
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throwNotFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    const data: { code?: string; name?: string } = {};
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throwBadRequest('CATEGORY_NAME_REQUIRED', 'name cannot be empty');
      }
      data.name = n;
    }
    if (input.code !== undefined) {
      const raw = input.code.trim();
      if (!raw) {
        throwBadRequest('CATEGORY_CODE_REQUIRED', 'code cannot be empty');
      }
      const lower = raw.toLowerCase();
      if (lower === existing.code.toLowerCase()) {
        // No change
      } else {
        if (!isValidCode(lower)) {
          throwBadRequest('CATEGORY_CODE_INVALID', 'code must match a-z0-9- (lowercase, no leading/trailing dash)');
        }
        const existingCodes = await this.repo.findCodes();
        const others = existingCodes.filter((c) => c.toLowerCase() !== existing.code.toLowerCase());
        data.code = dedupeCode(lower, others);
      }
    }
    if (!Object.keys(data).length) {
      return existing;
    }
    try {
      return await this.repo.update(id, data);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throwConflict('CATEGORY_CODE_CONFLICT', 'Category code already exists');
      }
      throw e;
    }
  }

  async reorderCategories(ids: string[]) {
    const cleaned = ids.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (!cleaned.length) {
      throwBadRequest('CATEGORY_REORDER_EMPTY', 'ids required');
    }
    const uniq = [...new Set(cleaned)];
    if (uniq.length !== cleaned.length) {
      throwBadRequest('CATEGORY_REORDER_DUPLICATE_IDS', 'duplicate ids');
    }
    const total = await this.repo.countAll();
    const count = await this.repo.countByIds(uniq);
    if (count !== uniq.length) {
      throwBadRequest('CATEGORY_NOT_FOUND', 'some ids not found');
    }
    if (uniq.length !== total) {
      throwBadRequest('CATEGORY_REORDER_INVALID', 'ids must include all categories');
    }
    await this.repo.reorder(uniq);
  }

  async deleteCategory(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throwNotFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    const n = await this.repo.countProducts(id);
    if (n > 0) {
      throwConflict('CATEGORY_IN_USE', 'Category still has products');
    }
    await this.repo.deleteById(id);
  }
}
