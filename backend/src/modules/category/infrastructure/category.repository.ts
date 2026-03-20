import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  findCodes(): Promise<string[]> {
    return this.prisma.category.findMany({ select: { code: true } }).then((rows) => rows.map((r) => r.code));
  }

  findById(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  create(data: { code: string; name: string }) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: { code?: string; name?: string }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  countProducts(categoryId: string) {
    return this.prisma.product.count({ where: { categoryId } });
  }

  countAll() {
    return this.prisma.category.count();
  }

  countByIds(ids: string[]) {
    return this.prisma.category.count({ where: { id: { in: ids } } });
  }

  deleteById(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.category.updateMany({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  productsForEnriched() {
    return this.prisma.product.findMany({
      where: { categoryId: { not: null } },
      select: {
        categoryId: true,
        tags: true,
        brand: { select: { code: true } },
      },
    });
  }
}
