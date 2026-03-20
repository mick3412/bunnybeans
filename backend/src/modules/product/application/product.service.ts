import { Injectable } from '@nestjs/common';
import { throwBadRequest, throwNotFound } from '../../../shared/utils/throw-exceptions';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ProductRepository } from '../infrastructure/product.repository';
import {
  parseCsvRows,
  PRODUCT_IMPORT_MAX_ROWS,
} from './csv-import.util';

interface CreateProductInput {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}

interface UpdateProductInput {
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
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
  barcode: string | null;
  name: string;
  description: string | null;
  specSize: string | null;
  specCapacity: string | null;
  specStyle: string | null;
  specWeight: string | null;
  expiryDescription: string | null;
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
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    specSize: p.specSize,
    specCapacity: p.specCapacity,
    specStyle: p.specStyle,
    specWeight: p.specWeight,
    expiryDescription: p.expiryDescription,
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
    minDaysUntilExpiry?: number;
  }) {
    const rows = await this.repo.findAll(filter);
    return rows.map(toProductResponse);
  }

  /**
   * GET /products/search-barcode?q=
   * 專用條碼查詢：以 barcode 精確查找（不做模糊 contains，避免誤命中）
   */
  async searchBarcode(q: string, limit = 20) {
    const term = q?.trim() ?? '';
    if (!term) return { items: [] as ReturnType<typeof toProductResponse>[] };
    const rows = await this.repo.searchByBarcode(term, limit);
    return { items: rows.map(toProductResponse) };
  }

  async getProduct(id: string, options?: { includeBalances?: boolean }) {
    const product = await this.repo.findById(id);
    if (!product) {
      throwNotFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    const out = toProductResponse(product) as Record<string, unknown>;
    if (options?.includeBalances) {
      const balances = await this.prisma.inventoryBalance.findMany({
        where: { productId: id },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
        },
      });
      out.balances = balances.map((b) => ({
        warehouseId: b.warehouseId,
        warehouseCode: b.warehouse.code,
        warehouseName: b.warehouse.name,
        onHandQty: b.onHandQty,
      }));
    }
    return out;
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

  /** 批次改價：將多個商品的 salePrice 設為同一值 */
  async batchUpdatePrice(
    productIds: string[],
    salePrice: string | number,
  ): Promise<{ updated: number }> {
    const ids = Array.isArray(productIds)
      ? productIds.filter((id) => typeof id === 'string' && id.trim())
      : [];
    if (ids.length === 0) {
      throwBadRequest('PRODUCT_BATCH_EMPTY', 'productIds required and must be non-empty');
    }
    const val =
      typeof salePrice === 'number'
        ? salePrice
        : parseFloat(String(salePrice ?? ''));
    if (Number.isNaN(val) || val < 0) {
      throwBadRequest('PRODUCT_BATCH_INVALID', 'salePrice must be a non-negative number');
    }
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { salePrice: val },
    });
    return { updated: result.count };
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
      throwBadRequest('PRODUCT_IMPORT_HEADER_SKU', 'CSV must include header column sku');
    }
    const dataRows = table.slice(1);
    if (dataRows.length > PRODUCT_IMPORT_MAX_ROWS) {
      throwBadRequest('PRODUCT_IMPORT_TOO_MANY_ROWS', `at most ${PRODUCT_IMPORT_MAX_ROWS} data rows`);
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
      const specCapacity = col('speccapacity', cells) || col('spec_capacity', cells) || null;
      const specStyle = col('specstyle', cells) || col('spec_style', cells) || null;
      const specWeight = col('specweight', cells) || col('spec_weight', cells) || null;
      const expiryDescription = col('expirydescription', cells) || col('expiry_description', cells) || null;
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
            ...(specCapacity !== null ? { specCapacity } : {}),
            ...(specStyle !== null ? { specStyle } : {}),
            ...(specWeight !== null ? { specWeight } : {}),
            ...(expiryDescription !== null ? { expiryDescription } : {}),
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
            specCapacity: specCapacity ?? undefined,
            specStyle: specStyle ?? undefined,
            specWeight: specWeight ?? undefined,
            expiryDescription: expiryDescription ?? undefined,
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
