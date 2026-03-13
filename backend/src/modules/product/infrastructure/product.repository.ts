import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

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
    categoryId?: string | null;
    brandId?: string | null;
    tags?: string[];
  }) {
    return this.prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
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
      categoryId?: string | null;
      brandId?: string | null;
      tags?: string[];
    },
  ) {
    const patch: Prisma.ProductUpdateInput = {};
    if (data.sku !== undefined) patch.sku = data.sku;
    if (data.name !== undefined) patch.name = data.name;
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
