import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { throwNotFound } from '../../../shared/utils/throw-exceptions';

function toNum(v: unknown): number {
  if (typeof v === 'object' && v != null && 'toNumber' in v)
    return (v as { toNumber: () => number }).toNumber();
  return Number(v ?? 0);
}

@Injectable()
export class StoreCreditService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(customerId: string): Promise<number> {
    const last = await this.prisma.storeCreditLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return toNum(last?.balanceAfter);
  }

  async getBalanceForStore(customerId: string, merchantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, merchantId },
    });
    if (!customer) throwNotFound('CUSTOMER_NOT_FOUND', 'Customer not found');

    const balance = await this.getBalance(customerId);
    return { customerId, merchantId, balance };
  }

  async getLedger(customerId: string, limit = 50) {
    return this.prisma.storeCreditLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
