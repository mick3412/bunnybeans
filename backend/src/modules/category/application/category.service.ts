import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dedupeCode, isValidCode, resolveCode } from '../../../shared/utils/canonical-code';
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
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException({
        message: 'name is required',
        code: 'CATEGORY_NAME_REQUIRED',
      });
    }
    let code: string;
    try {
      const existing = await this.repo.findCodes();
      const resolved = resolveCode(input.code, name, existing);
      code = resolved.code;
    } catch (e) {
      if ((e as Error).message === 'CODE_INVALID') {
        throw new BadRequestException({
          message: 'code must match a-z0-9- (lowercase, no leading/trailing dash)',
          code: 'CATEGORY_CODE_INVALID',
        });
      }
      throw e;
    }
    try {
      return await this.repo.create({ code, name });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: 'Category code already exists',
          code: 'CATEGORY_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async updateCategory(
    id: string,
    input: { code?: string; name?: string },
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    const data: { code?: string; name?: string } = {};
    if (input.name !== undefined) {
      const n = input.name.trim();
      if (!n) {
        throw new BadRequestException({
          message: 'name cannot be empty',
          code: 'CATEGORY_NAME_REQUIRED',
        });
      }
      data.name = n;
    }
    if (input.code !== undefined) {
      const raw = input.code.trim();
      if (!raw) {
        throw new BadRequestException({
          message: 'code cannot be empty',
          code: 'CATEGORY_CODE_REQUIRED',
        });
      }
      const lower = raw.toLowerCase();
      if (lower === existing.code.toLowerCase()) {
        // No change
      } else {
        if (!isValidCode(lower)) {
          throw new BadRequestException({
            message: 'code must match a-z0-9- (lowercase, no leading/trailing dash)',
            code: 'CATEGORY_CODE_INVALID',
          });
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
        throw new ConflictException({
          message: 'Category code already exists',
          code: 'CATEGORY_CODE_CONFLICT',
        });
      }
      throw e;
    }
  }

  async deleteCategory(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        message: 'Category not found',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
    const n = await this.repo.countProducts(id);
    if (n > 0) {
      throw new ConflictException({
        message: 'Category still has products',
        code: 'CATEGORY_IN_USE',
      });
    }
    await this.repo.deleteById(id);
  }
}
