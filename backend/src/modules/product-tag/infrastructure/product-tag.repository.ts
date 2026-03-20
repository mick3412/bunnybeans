import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class ProductTagRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(merchantId: string) {
    return this.prisma.productTag.findMany({
      where: { merchantId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  findCodes(merchantId: string): Promise<string[]> {
    return this.prisma.productTag
      .findMany({ where: { merchantId }, select: { code: true } })
      .then((rows) => rows.map((r) => r.code));
  }

  findById(id: string) {
    return this.prisma.productTag.findUnique({ where: { id } });
  }

  countByMerchant(merchantId: string) {
    return this.prisma.productTag.count({ where: { merchantId } });
  }

  countByIdsAndMerchant(merchantId: string, ids: string[]) {
    return this.prisma.productTag.count({
      where: { merchantId, id: { in: ids } },
    });
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

  async reorder(merchantId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.productTag.updateMany({
          where: { id, merchantId },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}
