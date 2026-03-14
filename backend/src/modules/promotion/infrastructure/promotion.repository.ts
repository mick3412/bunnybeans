import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PromotionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByMerchant(
    merchantId: string,
    opts: { status?: string; q?: string },
  ) {
    const where: Prisma.PromotionRuleWhereInput = { merchantId };
    if (opts.q?.trim()) {
      where.name = { contains: opts.q.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.promotionRule.findMany({
      where,
      orderBy: { priority: 'asc' },
    });
    const at = new Date();
    if (!opts.status || opts.status === 'all') return rows;
    return rows.filter((r) => {
      const s = this.displayStatus(r, at);
      return s === opts.status;
    });
  }

  displayStatus(
    r: {
      draft: boolean;
      startsAt: Date | null;
      endsAt: Date | null;
    },
    at: Date,
  ): 'draft' | 'scheduled' | 'active' | 'ended' {
    if (r.draft) return 'draft';
    if (r.startsAt && at < r.startsAt) return 'scheduled';
    if (r.endsAt && at > r.endsAt) return 'ended';
    return 'active';
  }

  async findById(id: string) {
    return this.prisma.promotionRule.findUnique({ where: { id } });
  }

  async create(data: Prisma.PromotionRuleCreateInput) {
    return this.prisma.promotionRule.create({ data });
  }

  async update(id: string, data: Prisma.PromotionRuleUpdateInput) {
    return this.prisma.promotionRule.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.promotionRule.delete({ where: { id } });
  }

  async reorder(merchantId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.promotionRule.updateMany({
          where: { id, merchantId },
          data: { priority: index + 1 },
        }),
      ),
    );
  }
}
