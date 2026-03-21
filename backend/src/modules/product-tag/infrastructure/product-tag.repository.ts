import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  findManyForPosDiscount(merchantId: string) {
    return this.prisma.productTag.findMany({
      where: { merchantId, showInPosDiscount: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: { id: true, name: true, code: true },
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

  create(data: {
    merchantId: string;
    name: string;
    code: string;
    showInPosDiscount?: boolean;
    autoCondition?: Prisma.InputJsonValue;
  }) {
    return this.prisma.productTag.create({ data });
  }

  update(
    id: string,
    data: { name?: string; code?: string; showInPosDiscount?: boolean; autoCondition?: Prisma.InputJsonValue },
  ) {
    return this.prisma.productTag.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.productTag.delete({ where: { id } });
  }

  async reorder(merchantId: string, ids: string[]) {
    if (ids.length === 0) return;
    const cases = Prisma.join(
      ids.map((id, index) => Prisma.sql`WHEN ${id} THEN ${index}`),
      ' ',
    );
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE "ProductTag" SET "sortOrder" = CASE "id" ${cases} END WHERE "merchantId" = ${merchantId} AND "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`), ', ')})`,
    );
  }
}
