import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class ProductTagRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(merchantId: string) {
    return this.prisma.productTag.findMany({
      where: { merchantId },
      orderBy: { code: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.productTag.findUnique({ where: { id } });
  }

  create(data: { merchantId: string; name: string; code: string }) {
    return this.prisma.productTag.create({ data });
  }

  update(id: string, data: { name?: string; code?: string }) {
    return this.prisma.productTag.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.productTag.delete({ where: { id } });
  }
}
