import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter?: { search?: string; sku?: string; categoryId?: string }) {
    type Where = {
      sku?: string;
      categoryId?: string;
      OR?: Array<{ sku?: { contains: string; mode: 'insensitive' }; name?: { contains: string; mode: 'insensitive' } }>;
    };
    const where: Where = {};
    if (filter?.sku?.trim()) {
      where.sku = filter.sku.trim();
    } else if (filter?.search?.trim()) {
      const term = filter.search.trim();
      where.OR = [
        { sku: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }
    if (filter?.categoryId?.trim()) {
      where.categoryId = filter.categoryId.trim();
    }
    return this.prisma.product.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { sku: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  create(data: { sku: string; name: string }) {
    return this.prisma.product.create({ data });
  }

  update(id: string, data: { sku?: string; name?: string }) {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  delete(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}

