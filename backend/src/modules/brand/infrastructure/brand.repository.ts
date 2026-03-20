import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  findCodes(): Promise<string[]> {
    return this.prisma.brand.findMany({ select: { code: true } }).then((rows) => rows.map((r) => r.code));
  }

  findById(id: string) {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  create(data: { code: string; name: string }) {
    return this.prisma.brand.create({ data });
  }

  update(id: string, data: { code?: string; name?: string }) {
    return this.prisma.brand.update({ where: { id }, data });
  }

  countProducts(brandId: string) {
    return this.prisma.product.count({ where: { brandId } });
  }

  countAll() {
    return this.prisma.brand.count();
  }

  countByIds(ids: string[]) {
    return this.prisma.brand.count({ where: { id: { in: ids } } });
  }

  deleteById(id: string) {
    return this.prisma.brand.delete({ where: { id } });
  }

  async reorder(ids: string[]) {
    if (ids.length === 0) return;
    const cases = Prisma.join(
      ids.map((id, index) => Prisma.sql`WHEN ${id} THEN ${index}`),
      ' ',
    );
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "Brand" SET "sortOrder" = CASE "id" ${cases} END WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`), ', ')})`,
    );
  }
}
