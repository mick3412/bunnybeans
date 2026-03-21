import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { throwBadRequest, throwConflict, throwNotFound } from '../../../shared/utils/throw-exceptions';

export interface SessionReportDto {
  period: { from: string; to: string };
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  byPaymentMethod?: Record<string, number>;
  ordersCount: number;
  refundsCount: number;
}

export interface CashRegisterSessionDto {
  id: string;
  storeId: string;
  merchantId: string;
  openedAt: string;
  closedAt?: string;
  openingCashAmount: number;
  expectedCashAmount?: number;
  actualCashAmount?: number;
  differenceAmount?: number;
  openedBy?: string;
  closedBy?: string;
  status: string;
  note?: string;
  report?: SessionReportDto;
}

@Injectable()
export class PosSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStoreWithMerchant(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, merchantId: true },
    });
    if (!store) throwNotFound('POS_STORE_NOT_FOUND', 'Store not found');
    return store;
  }

  /**
   * 計算 session 區間內的現金銷售、現金退款、訂單數、退款數、byPaymentMethod
   */
  private async computeSessionStats(
    storeId: string,
    from: Date,
    to: Date,
  ): Promise<{
    cashSales: number;
    cashRefunds: number;
    ordersCount: number;
    refundsCount: number;
    byPaymentMethod: Record<string, number>;
  }> {
    const orderWhere = {
      storeId,
      createdAt: { gte: from, lte: to },
    };

    const [paymentRows, orders] = await Promise.all([
      this.prisma.posOrderPayment.findMany({
        where: { order: orderWhere },
        select: { method: true, amount: true },
      }),
      this.prisma.posOrder.findMany({ where: orderWhere, select: { id: true } }),
    ]);

    const orderIds = orders.map((o) => o.id);
    let refundSum = 0;
    let refundCount = 0;
    if (orderIds.length > 0) {
      const agg = await this.prisma.financeEvent.aggregate({
        where: { type: 'SALE_REFUND', referenceId: { in: orderIds } },
        _sum: { amount: true },
        _count: true,
      });
      refundSum = Number(agg._sum.amount ?? 0);
      refundCount = agg._count;
    }

    let cashSales = 0;
    const byPaymentMethod: Record<string, number> = {};
    for (const row of paymentRows) {
      const m = row.method || 'UNKNOWN';
      const amt = Number(row.amount);
      byPaymentMethod[m] = (byPaymentMethod[m] ?? 0) + amt;
      if (m === 'CASH') cashSales += amt;
    }

    return {
      cashSales,
      cashRefunds: refundSum,
      ordersCount: orderIds.length,
      refundsCount: refundCount,
      byPaymentMethod,
    };
  }

  private toDto(row: {
    id: string;
    storeId: string;
    merchantId: string;
    openedAt: Date;
    closedAt: Date | null;
    openingCashAmount: unknown;
    expectedCashAmount: unknown;
    actualCashAmount: unknown;
    differenceAmount: unknown;
    openedBy: string | null;
    closedBy: string | null;
    status: string;
    note: string | null;
  }): CashRegisterSessionDto {
    return {
      id: row.id,
      storeId: row.storeId,
      merchantId: row.merchantId,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt?.toISOString(),
      openingCashAmount: Number(row.openingCashAmount),
      expectedCashAmount: row.expectedCashAmount != null ? Number(row.expectedCashAmount) : undefined,
      actualCashAmount: row.actualCashAmount != null ? Number(row.actualCashAmount) : undefined,
      differenceAmount: row.differenceAmount != null ? Number(row.differenceAmount) : undefined,
      openedBy: row.openedBy ?? undefined,
      closedBy: row.closedBy ?? undefined,
      status: row.status,
      note: row.note ?? undefined,
    };
  }

  async openSession(input: {
    storeId: string;
    openingCashAmount: number;
    openedBy?: string;
  }): Promise<CashRegisterSessionDto> {
    const store = await this.getStoreWithMerchant(input.storeId);
    if (input.openingCashAmount < 0 || Number.isNaN(input.openingCashAmount)) {
      throwBadRequest('POS_SESSION_INVALID_AMOUNT', 'openingCashAmount must be >= 0');
    }

    const existing = await this.prisma.cashRegisterSession.findFirst({
      where: { storeId: input.storeId, status: 'OPEN' },
    });
    if (existing) {
      throwConflict('POS_SESSION_ALREADY_OPEN', 'Store already has an open session');
    }

    const session = await this.prisma.cashRegisterSession.create({
      data: {
        storeId: input.storeId,
        merchantId: store.merchantId,
        openingCashAmount: input.openingCashAmount,
        openedBy: input.openedBy?.trim() || null,
        status: 'OPEN',
      },
    });

    return this.toDto(session);
  }

  async getCurrentSession(storeId: string): Promise<(CashRegisterSessionDto & { report: SessionReportDto }) | null> {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { storeId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
    if (!session) return null;

    const to = new Date();
    const stats = await this.computeSessionStats(storeId, session.openedAt, to);
    const expectedCash = Number(session.openingCashAmount) + stats.cashSales - stats.cashRefunds;

    const dto = this.toDto(session);
    const report: SessionReportDto = {
      period: {
        from: session.openedAt.toISOString().slice(0, 19),
        to: to.toISOString().slice(0, 19),
      },
      openingCash: Number(session.openingCashAmount),
      cashSales: stats.cashSales,
      cashRefunds: stats.cashRefunds,
      expectedCash,
      byPaymentMethod: Object.keys(stats.byPaymentMethod).length > 0 ? stats.byPaymentMethod : undefined,
      ordersCount: stats.ordersCount,
      refundsCount: stats.refundsCount,
    };

    return { ...dto, report };
  }

  async closeSession(
    id: string,
    input: { actualCashAmount: number; closedBy?: string; note?: string },
  ): Promise<CashRegisterSessionDto & { report: SessionReportDto }> {
    const session = await this.prisma.cashRegisterSession.findUnique({
      where: { id },
    });
    if (!session) throwNotFound('POS_SESSION_NOT_FOUND', 'Session not found');
    if (session.status !== 'OPEN') {
      throwBadRequest('POS_SESSION_ALREADY_CLOSED', 'Session is already closed');
    }
    if (input.actualCashAmount < 0 || Number.isNaN(input.actualCashAmount)) {
      throwBadRequest('POS_SESSION_INVALID_AMOUNT', 'actualCashAmount must be >= 0');
    }

    const to = new Date();
    const stats = await this.computeSessionStats(session.storeId, session.openedAt, to);
    const expectedCash = Number(session.openingCashAmount) + stats.cashSales - stats.cashRefunds;
    const difference = input.actualCashAmount - expectedCash;

    const updated = await this.prisma.cashRegisterSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: to,
        closedBy: input.closedBy?.trim() || null,
        note: input.note?.trim() || null,
        expectedCashAmount: expectedCash,
        actualCashAmount: input.actualCashAmount,
        differenceAmount: difference,
      },
    });

    const report: SessionReportDto = {
      period: {
        from: session.openedAt.toISOString().slice(0, 19),
        to: to.toISOString().slice(0, 19),
      },
      openingCash: Number(session.openingCashAmount),
      cashSales: stats.cashSales,
      cashRefunds: stats.cashRefunds,
      expectedCash,
      actualCash: input.actualCashAmount,
      difference,
      byPaymentMethod: Object.keys(stats.byPaymentMethod).length > 0 ? stats.byPaymentMethod : undefined,
      ordersCount: stats.ordersCount,
      refundsCount: stats.refundsCount,
    };

    return { ...this.toDto(updated), report };
  }

  async listSessions(filter: {
    storeId?: string;
    merchantId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: CashRegisterSessionDto[]; total: number }> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const where: Record<string, unknown> = {};
    if (filter.storeId?.trim()) where.storeId = filter.storeId.trim();
    if (filter.merchantId?.trim()) where.merchantId = filter.merchantId.trim();
    if (filter.status?.trim()) where.status = filter.status.trim();

    if (filter.from?.trim() || filter.to?.trim()) {
      where.openedAt = {};
      if (filter.from?.trim()) {
        (where.openedAt as Record<string, Date>).gte = new Date(filter.from.trim());
      }
      if (filter.to?.trim()) {
        const toDate = new Date(filter.to.trim());
        toDate.setHours(23, 59, 59, 999);
        (where.openedAt as Record<string, Date>).lte = toDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.cashRegisterSession.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { store: { select: { code: true, name: true } } },
      }),
      this.prisma.cashRegisterSession.count({ where }),
    ]);

    const dtos = items.map((r) => {
      const { store, ...session } = r;
      return {
        ...this.toDto(session),
        storeCode: store?.code,
        storeName: store?.name,
      };
    });

    return { items: dtos, total };
  }

  async getSessionById(id: string): Promise<CashRegisterSessionDto & { report?: SessionReportDto }> {
    const session = await this.prisma.cashRegisterSession.findUnique({
      where: { id },
    });
    if (!session) throwNotFound('POS_SESSION_NOT_FOUND', 'Session not found');

    const to = session.closedAt ?? new Date();
    const stats = await this.computeSessionStats(session.storeId, session.openedAt, to);
    const expectedCash =
      session.expectedCashAmount != null
        ? Number(session.expectedCashAmount)
        : Number(session.openingCashAmount) + stats.cashSales - stats.cashRefunds;

    const report: SessionReportDto = {
      period: {
        from: session.openedAt.toISOString().slice(0, 19),
        to: to.toISOString().slice(0, 19),
      },
      openingCash: Number(session.openingCashAmount),
      cashSales: stats.cashSales,
      cashRefunds: stats.cashRefunds,
      expectedCash,
      actualCash: session.actualCashAmount != null ? Number(session.actualCashAmount) : undefined,
      difference: session.differenceAmount != null ? Number(session.differenceAmount) : undefined,
      byPaymentMethod: Object.keys(stats.byPaymentMethod).length > 0 ? stats.byPaymentMethod : undefined,
      ordersCount: stats.ordersCount,
      refundsCount: stats.refundsCount,
    };

    return { ...this.toDto(session), report };
  }
}
