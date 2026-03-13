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

  findAll(filter?: {
    search?: string;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tag?: string;
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
    const where: Where = and.length ? { AND: and } : {};
    return this.prisma.product.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { sku: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  create(data: {
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
  }) {
    return this.prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description ?? undefined,
        specSize: data.specSize ?? undefined,
        specColor: data.specColor ?? undefined,
        weightGrams: data.weightGrams ?? undefined,
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
    },
  ) {
    const patch: Prisma.ProductUpdateInput = {};
    if (data.sku !== undefined) patch.sku = data.sku;
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description ?? null;
    if (data.specSize !== undefined) patch.specSize = data.specSize ?? null;
    if (data.specColor !== undefined) patch.specColor = data.specColor ?? null;
    if (data.weightGrams !== undefined) patch.weightGrams = data.weightGrams ?? null;
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
