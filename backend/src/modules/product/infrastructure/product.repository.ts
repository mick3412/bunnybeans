import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

function toDec(v: string | number | null | undefined, fallback = '0'): Prisma.Decimal {
  if (v === null || v === undefined || v === '') return new Prisma.Decimal(fallback);
  return new Prisma.Decimal(String(v));
}

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  private computeExpiryDate(p: { expiryDate: Date | null; productionDate: Date | null; shelfLifeMonths: number | null }): Date | null {
    if (p.expiryDate) return p.expiryDate;
    if (p.productionDate && p.shelfLifeMonths != null && Number.isFinite(p.shelfLifeMonths)) {
      const d = new Date(p.productionDate);
      d.setUTCMonth(d.getUTCMonth() + p.shelfLifeMonths);
      return d;
    }
    return null;
  }

  private buildExpiryBoundaryUtc(minDaysUntilExpiry: number): Date | null {
    if (!Number.isFinite(minDaysUntilExpiry)) return null;
    const n = Math.floor(minDaysUntilExpiry);
    if (n < 0) return null;
    // 「日曆剩餘天數」嚴格大於 N：以 UTC 當日 00:00 為界，需 >= today + (N+1) 天的 00:00
    const boundary = new Date();
    boundary.setUTCHours(0, 0, 0, 0);
    boundary.setUTCDate(boundary.getUTCDate() + n + 1);
    return boundary;
  }

  private buildProductWhere(filter?: {
    search?: string;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tag?: string;
    minDaysUntilExpiry?: number;
  }) {
    type Where = Prisma.ProductWhereInput;
    const and: Where[] = [];
    if (filter?.sku?.trim()) {
      and.push({ sku: filter.sku.trim() });
    } else if (filter?.search?.trim()) {
      const term = filter.search.trim();
      and.push({
        OR: [
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      });
    }
    if (filter?.categoryId?.trim()) {
      and.push({ categoryId: filter.categoryId.trim() });
    }
    if (filter?.brandId?.trim()) {
      and.push({ brandId: filter.brandId.trim() });
    }
    if (filter?.tag?.trim()) {
      and.push({
        tags: { array_contains: filter.tag.trim() },
      });
    }
    return and.length ? { AND: and } : {};
  }

  async findAll(
    filter?: {
      search?: string;
      sku?: string;
      categoryId?: string;
      brandId?: string;
      tag?: string;
      /** 僅回傳「日曆剩餘天數」嚴格大於 N 之商品（UTC 日界；支援 expiryDate 或 productionDate+shelfLifeMonths 推算） */
      minDaysUntilExpiry?: number;
    },
    opts?: { includeBrand?: boolean; page?: number; pageSize?: number },
  ) {
    const boundary = filter?.minDaysUntilExpiry != null ? this.buildExpiryBoundaryUtc(filter.minDaysUntilExpiry) : null;
    const baseWhere = this.buildProductWhere(
      boundary ? { ...(filter ?? {}), minDaysUntilExpiry: undefined } : filter,
    ) as Prisma.ProductWhereInput;
    const select: Prisma.ProductSelect = {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      description: true,
      specSize: true,
      specCapacity: true,
      specStyle: true,
      specWeight: true,
      expiryDescription: true,
      productionDate: true,
      shelfLifeMonths: true,
      expiryDate: true,
      listPrice: true,
      salePrice: true,
      costPrice: true,
      categoryId: true,
      brandId: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
    };
    if (opts?.includeBrand) {
      select.brand = { select: { name: true } };
    }
    const page = opts?.page ?? 1;
    const pageSize = Math.min(200, Math.max(1, opts?.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    // 若有 minDaysUntilExpiry，需納入 productionDate+shelfLifeMonths 推算效期；
    // Prisma 無法方便地在 DB 端計算 addMonths，因此改以應用層過濾後再分頁。
    if (boundary) {
      const all = await this.prisma.product.findMany({
        where: Object.keys(baseWhere).length ? baseWhere : undefined,
        orderBy: { sku: 'asc' },
        take: 10_000,
        select,
      });
      const filtered = all.filter((p) => {
        const exp = this.computeExpiryDate({
          expiryDate: (p as { expiryDate: Date | null }).expiryDate ?? null,
          productionDate: (p as { productionDate: Date | null }).productionDate ?? null,
          shelfLifeMonths: (p as { shelfLifeMonths: number | null }).shelfLifeMonths ?? null,
        });
        return exp != null && exp >= boundary;
      });
      const items = filtered.slice(skip, skip + pageSize);
      return { items, total: filtered.length, page, pageSize };
    }

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where: Object.keys(baseWhere).length ? baseWhere : undefined }),
      this.prisma.product.findMany({
        where: Object.keys(baseWhere).length ? baseWhere : undefined,
        orderBy: { sku: 'asc' },
        skip,
        take: pageSize,
        select,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 匯出用：與 list 同篩選，最多 1 萬列；含 categoryCode、brandCode 以對齊 import 格式 */
  async findManyForExport(filter?: {
    search?: string;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tag?: string;
    minDaysUntilExpiry?: number;
  }) {
    const boundary =
      filter?.minDaysUntilExpiry != null
        ? this.buildExpiryBoundaryUtc(filter.minDaysUntilExpiry)
        : null;
    const baseWhere = this.buildProductWhere(
      boundary ? { ...(filter ?? {}), minDaysUntilExpiry: undefined } : filter,
    ) as Prisma.ProductWhereInput;
    const where = Object.keys(baseWhere).length ? baseWhere : undefined;
    const select = {
      sku: true,
      name: true,
      barcode: true,
      description: true,
      specSize: true,
      specCapacity: true,
      specStyle: true,
      specWeight: true,
      expiryDescription: true,
      productionDate: true,
      shelfLifeMonths: true,
      expiryDate: true,
      listPrice: true,
      salePrice: true,
      costPrice: true,
      tags: true,
      category: { select: { code: true } },
      brand: { select: { code: true } },
    } as const;

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      take: 10_000,
      select,
    });
    if (!boundary) return rows;
    return rows.filter((p) => {
      const exp = this.computeExpiryDate({
        expiryDate: p.expiryDate ?? null,
        productionDate: p.productionDate ?? null,
        shelfLifeMonths: p.shelfLifeMonths ?? null,
      });
      return exp != null && exp >= boundary;
    });
  }

  findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  findBySku(sku: string) {
    return this.prisma.product.findUnique({ where: { sku } });
  }

  searchByBarcode(barcode: string, limit = 20) {
    const term = barcode.trim();
    if (!term) return Promise.resolve([]);
    return this.prisma.product.findMany({
      where: { barcode: { equals: term, mode: 'insensitive' } },
      take: Math.min(50, Math.max(1, limit)),
      orderBy: { sku: 'asc' },
    });
  }

  create(data: {
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
  }) {
    return this.prisma.product.create({
      data: {
        sku: data.sku,
        barcode: data.barcode?.trim() || null,
        name: data.name,
        description: data.description ?? undefined,
        specSize: data.specSize ?? undefined,
        specColor: data.specColor ?? undefined,
        weightGrams: data.weightGrams ?? undefined,
        specCapacity: data.specCapacity ?? undefined,
        specStyle: data.specStyle ?? undefined,
        specWeight: data.specWeight ?? undefined,
        expiryDescription: data.expiryDescription ?? undefined,
        listPrice: toDec(data.listPrice, '0'),
        salePrice: toDec(data.salePrice, '0'),
        costPrice:
          data.costPrice === null || data.costPrice === undefined || data.costPrice === ''
            ? undefined
            : toDec(data.costPrice),
        categoryId: data.categoryId ?? undefined,
        brandId: data.brandId ?? undefined,
        tags: (data.tags ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  update(
    id: string,
    data: {
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
    },
  ) {
    const patch: Prisma.ProductUpdateInput = {};
    if (data.sku !== undefined) patch.sku = data.sku;
    if (data.barcode !== undefined) patch.barcode = data.barcode?.trim() || null;
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.specSize !== undefined) patch.specSize = data.specSize ?? null;
    if (data.specColor !== undefined) patch.specColor = data.specColor ?? null;
    if (data.weightGrams !== undefined) patch.weightGrams = data.weightGrams ?? null;
    if (data.specCapacity !== undefined) patch.specCapacity = data.specCapacity ?? null;
    if (data.specStyle !== undefined) patch.specStyle = data.specStyle ?? null;
    if (data.specWeight !== undefined) patch.specWeight = data.specWeight ?? null;
    if (data.expiryDescription !== undefined) patch.expiryDescription = data.expiryDescription ?? null;
    if (data.listPrice !== undefined) patch.listPrice = toDec(data.listPrice, '0');
    if (data.salePrice !== undefined) patch.salePrice = toDec(data.salePrice, '0');
    if (data.costPrice !== undefined) {
      patch.costPrice =
        data.costPrice === null || data.costPrice === '' ? null : toDec(data.costPrice);
    }
    if (data.categoryId !== undefined) {
      patch.category = data.categoryId
        ? { connect: { id: data.categoryId } }
        : { disconnect: true };
    }
    if (data.brandId !== undefined) {
      patch.brand = data.brandId
        ? { connect: { id: data.brandId } }
        : { disconnect: true };
    }
    if (data.tags !== undefined) patch.tags = data.tags as Prisma.InputJsonValue;
    return this.prisma.product.update({
      where: { id },
      data: patch,
    });
  }

  delete(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
