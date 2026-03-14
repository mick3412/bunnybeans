import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ProductRepository } from '../infrastructure/product.repository';
import {
  parseCsvRows,
  PRODUCT_IMPORT_MAX_ROWS,
} from './csv-import.util';

interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

function decToStr(v: Decimal | null | undefined): string | null {
  if (v == null) return null;
  return v.toFixed(2);
}

function toProductResponse(p: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  specSize: string | null;
  specColor: string | null;
  weightGrams: number | null;
  listPrice: Decimal;
  salePrice: Decimal;
  costPrice: Decimal | null;
  categoryId: string | null;
  brandId: string | null;
  tags: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  const tags = Array.isArray(p.tags)
    ? (p.tags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    specSize: p.specSize,
    specColor: p.specColor,
    weightGrams: p.weightGrams,
    listPrice: decToStr(p.listPrice) ?? '0.00',
    salePrice: decToStr(p.salePrice) ?? '0.00',
    costPrice: decToStr(p.costPrice),
    categoryId: p.categoryId,
    brandId: p.brandId,
    tags,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProductService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listProducts(filter?: {
    search?: string;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tag?: string;
  }) {
    const rows = await this.repo.findAll(filter);
    return rows.map(toProductResponse);
  }

  async getProduct(id: string) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return toProductResponse(product);
  }

  async createProduct(input: CreateProductInput) {
    const p = await this.repo.create(input);
    return toProductResponse(p);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    await this.getProduct(id);
    const p = await this.repo.update(id, input);
    return toProductResponse(p);
  }

  async deleteProduct(id: string) {
    await this.getProduct(id);
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * CSV 批量匯入：sku 必填；已存在則 update、否則 create（name 預設 sku）。
   * 回傳 { ok, failed }；列上限 PRODUCT_IMPORT_MAX_ROWS。
   */
  async importFromCsvBuffer(buf: Buffer): Promise<{
    ok: number;
    failed: { row: number; reason: string }[];
  }> {
    const text = buf.toString('utf8');
    const table = parseCsvRows(text);
    if (table.length === 0) {
      return { ok: 0, failed: [{ row: 0, reason: 'empty csv' }] };
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const skuIdx = header.indexOf('sku');
    if (skuIdx < 0) {
      throw new BadRequestException({
        message: 'CSV must include header column sku',
        code: 'PRODUCT_IMPORT_HEADER_SKU',
      });
    }
    const dataRows = table.slice(1);
    if (dataRows.length > PRODUCT_IMPORT_MAX_ROWS) {
      throw new BadRequestException({
        message: `at most ${PRODUCT_IMPORT_MAX_ROWS} data rows`,
        code: 'PRODUCT_IMPORT_TOO_MANY_ROWS',
      });
    }
    const col = (name: string, cells: string[]) => {
      const j = header.indexOf(name);
      return j >= 0 ? (cells[j] ?? '').trim() : '';
    };
    let ok = 0;
    const failed: { row: number; reason: string }[] = [];
    for (let r = 0; r < dataRows.length; r++) {
      const cells = dataRows[r];
      const rowNum = r + 2;
      const sku = (cells[skuIdx] ?? '').trim();
      if (!sku) {
        failed.push({ row: rowNum, reason: 'sku required' });
        continue;
      }
      const nameVal = col('name', cells);
      const description = col('description', cells) || null;
      const specSize = col('specsize', cells) || col('spec_size', cells) || null;
      const specColor = col('speccolor', cells) || col('spec_color', cells) || null;
      const weightStr = col('weightgrams', cells) || col('weight_grams', cells);
      let weightGrams: number | null = null;
      if (weightStr) {
        const w = parseInt(weightStr, 10);
        if (Number.isNaN(w)) {
          failed.push({ row: rowNum, reason: 'invalid weightGrams' });
          continue;
        }
        weightGrams = w;
      }
      const listPrice = col('listprice', cells) || col('list_price', cells);
      const salePrice = col('saleprice', cells) || col('sale_price', cells);
      const costPrice = col('costprice', cells) || col('cost_price', cells);
      const categoryCode = col('categorycode', cells) || col('category_code', cells);
      const brandCode = col('brandcode', cells) || col('brand_code', cells);
      const tagsStr = col('tags', cells);
      let categoryId: string | null = null;
      let brandId: string | null = null;
      if (categoryCode) {
        const cat = await this.prisma.category.findUnique({
          where: { code: categoryCode },
        });
        if (!cat) {
          failed.push({
            row: rowNum,
            reason: `category not found: ${categoryCode}`,
          });
          continue;
        }
        categoryId = cat.id;
      }
      if (brandCode) {
        const br = await this.prisma.brand.findUnique({
          where: { code: brandCode },
        });
        if (!br) {
          failed.push({ row: rowNum, reason: `brand not found: ${brandCode}` });
          continue;
        }
        brandId = br.id;
      }
      const tags = tagsStr
        ? tagsStr
            .split('|')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
      const existing = await this.repo.findBySku(sku);
      try {
        if (existing) {
          await this.repo.update(existing.id, {
            ...(nameVal ? { name: nameVal } : {}),
            ...(description !== null ? { description } : {}),
            ...(specSize !== null ? { specSize } : {}),
            ...(specColor !== null ? { specColor } : {}),
            ...(weightGrams !== null ? { weightGrams } : {}),
            ...(listPrice !== '' ? { listPrice } : {}),
            ...(salePrice !== '' ? { salePrice } : {}),
            ...(costPrice !== '' ? { costPrice } : {}),
            ...(categoryCode ? { categoryId } : {}),
            ...(brandCode ? { brandId } : {}),
            ...(tags !== undefined ? { tags } : {}),
          });
        } else {
          const createName = nameVal || sku;
          await this.repo.create({
            sku,
            name: createName,
            description: description ?? undefined,
            specSize: specSize ?? undefined,
            specColor: specColor ?? undefined,
            weightGrams: weightGrams ?? undefined,
            listPrice: listPrice || '0',
            salePrice: salePrice || '0',
            costPrice: costPrice || undefined,
            categoryId: categoryId ?? undefined,
            brandId: brandId ?? undefined,
            tags: tags ?? [],
          });
        }
        ok++;
      } catch (e) {
        failed.push({
          row: rowNum,
          reason: e instanceof Error ? e.message : 'write failed',
        });
      }
    }
    return { ok, failed };
  }
}
