import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.brand.findMany({ orderBy: { code: 'asc' } });
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

  deleteById(id: string) {
    return this.prisma.brand.delete({ where: { id } });
  }
}
