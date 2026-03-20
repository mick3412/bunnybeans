import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { FinanceEventType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface RecordFinanceEventData {
  type: FinanceEventType;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount?: number;
  occurredAt: Date;
  referenceId?: string;
  note?: string;
}

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendEvent(data: RecordFinanceEventData) {
    return this.prisma.financeEvent.create({
      data: {
        type: data.type,
        partyId: data.partyId,
        currency: data.currency,
        amount: new Decimal(data.amount),
        taxAmount: data.taxAmount != null ? new Decimal(data.taxAmount) : null,
        occurredAt: data.occurredAt,
        referenceId: data.referenceId ?? null,
        note: data.note ?? null,
      },
    });
  }

  async listEvents(params: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.partyId !== undefined) where.partyId = params.partyId;
    if (params.referenceId !== undefined) where.referenceId = params.referenceId;
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }
    const skip = (params.page - 1) * params.pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.financeEvent.count({ where }),
      this.prisma.financeEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: params.pageSize,
      }),
    ]);
    return { items: rows, total };
  }

  /** 與 listEvents 相同篩選；最多 1 萬筆；匯出用 */
  async listEventsExport(params: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.partyId !== undefined) where.partyId = params.partyId;
    if (params.referenceId !== undefined) where.referenceId = params.referenceId;
    if (params.type) where.type = params.type;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }
    return this.prisma.financeEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 10_000,
    });
  }

  /** 依 type 彙總區間內金額（groupBy=type） */
  async summaryByType(params: { from?: Date; to?: Date }) {
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }
    const rows = await this.prisma.financeEvent.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    });
    const byType: Record<string, number> = {};
    for (const r of rows) {
      byType[r.type] = Number(r._sum.amount ?? 0);
    }
    return { byType };
  }

  /** 依 partyId 彙總區間內金額（groupBy=partyId）；回傳每 party 各 type 加總 */
  async summaryByPartyId(params: { from?: Date; to?: Date }) {
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }
    const rows = await this.prisma.financeEvent.groupBy({
      by: ['partyId', 'type'],
      where,
      _sum: { amount: true },
    });
    const byParty = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (!r.partyId) continue;
      let map = byParty.get(r.partyId);
      if (!map) {
        map = {};
        byParty.set(r.partyId, map);
      }
      map[r.type] = Number(r._sum.amount ?? 0);
    }
    const partyIds = Array.from(byParty.keys());
    const resolved = await this.resolvePartyDisplayAndKind(partyIds);
    return {
      byParty: partyIds.map((partyId) => ({
        partyId,
        amountsByType: byParty.get(partyId)!,
        displayName: resolved.get(partyId)?.displayName,
        kind: resolved.get(partyId)?.kind,
      })),
    };
  }

  /** 期間趨勢：依 day/week 分桶，回傳每桶各 type 加總 */
  async summaryTrend(params: { from?: Date; to?: Date; bucket: 'day' | 'week' }): Promise<{
    bucket: 'day' | 'week';
    items: Array<{ periodStart: string; amountsByType: Record<string, number> }>;
  }> {
    const rows = await this.prisma.$queryRaw<
      { periodStart: Date; type: FinanceEventType; amountSum: Decimal }[]
    >(
      Prisma.sql`
        SELECT
          date_trunc(${params.bucket}, "occurredAt") AS "periodStart",
          "type" AS "type",
          SUM("amount") AS "amountSum"
        FROM "FinanceEvent"
        WHERE
          (${params.from}::timestamptz IS NULL OR "occurredAt" >= ${params.from})
          AND (${params.to}::timestamptz IS NULL OR "occurredAt" <= ${params.to})
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,
    );
    const by = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const key = r.periodStart.toISOString();
      const cur = by.get(key) ?? {};
      cur[r.type] = Number(r.amountSum ?? 0);
      by.set(key, cur);
    }
    return {
      bucket: params.bucket,
      items: Array.from(by.entries()).map(([periodStart, amountsByType]) => ({
        periodStart,
        amountsByType,
      })),
    };
  }

  /** 應收／應付餘額：依 partyId 彙總全部事件，與事件表可重算一致。支援 kind 篩選與 displayName／kind 解析。 */
  async balancesByPartyId(
    params: {
      merchantId: string;
      partyId?: string;
      kind?: 'customer' | 'supplier';
      page: number;
      pageSize: number;
    },
  ): Promise<{
    items: Array<{
      partyId: string;
      receivable: number;
      payable: number;
      displayName?: string;
      kind?: string;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totals: { receivable: number; payable: number };
  }> {
    const merchantId = params.merchantId?.trim();
    const where: Prisma.FinanceEventWhereInput = {};
    if (params.partyId?.trim()) where.partyId = params.partyId.trim();

    // Multi-merchant isolation: restrict to parties owned by merchantId (via Party view).
    if (merchantId) {
      const partyRows = await this.prisma.$queryRaw<{ partyId: string }[]>(
        Prisma.sql`
          SELECT "partyId"
          FROM "Party"
          WHERE "merchantId" = ${merchantId}
          ${params.kind ? Prisma.sql`AND "kind" = ${params.kind}` : Prisma.empty}
        `,
      );
      const allowedPartyIds = partyRows.map((r) => r.partyId);
      if (allowedPartyIds.length === 0) {
        return {
          items: [],
          page: params.page,
          pageSize: params.pageSize,
          total: 0,
          totals: { receivable: 0, payable: 0 },
        };
      }
      if (typeof where.partyId === 'string') {
        if (!allowedPartyIds.includes(where.partyId)) {
          return {
            items: [],
            page: params.page,
            pageSize: params.pageSize,
            total: 0,
            totals: { receivable: 0, payable: 0 },
          };
        }
      } else {
        where.partyId = { in: allowedPartyIds };
      }
    }
    const rows = await this.prisma.financeEvent.groupBy({
      by: ['partyId', 'type'],
      where,
      _sum: { amount: true },
    });
    const byParty = new Map<string, { receivable: number; payable: number }>();
    for (const r of rows) {
      if (!r.partyId) continue;
      let cur = byParty.get(r.partyId);
      if (!cur) {
        cur = { receivable: 0, payable: 0 };
        byParty.set(r.partyId, cur);
      }
      const amt = Number(r._sum.amount ?? 0);
      if (r.type === 'SALE_RECEIVABLE') cur.receivable += amt;
      else if (r.type === 'SALE_PAYMENT' || r.type === 'SALE_REFUND') cur.receivable -= amt;
      else if (r.type === 'PURCHASE_PAYABLE') cur.payable += amt;
      else if (r.type === 'PURCHASE_RETURN') cur.payable -= amt;
    }
    const rawItems = Array.from(byParty.entries()).map(([partyId, v]) => ({
      partyId,
      receivable: v.receivable,
      payable: v.payable,
    }));

    const partyIds = rawItems.map((i) => i.partyId);
    const resolved = await this.resolvePartyDisplayAndKind(partyIds);
    let items = rawItems.map((item) => ({
      ...item,
      displayName: resolved.get(item.partyId)?.displayName,
      kind: resolved.get(item.partyId)?.kind,
    }));
    // kind filter already applied via Party view restriction above (when merchantId present),
    // but keep it for backward compatibility / legacy partyIds.
    if (params.kind) items = items.filter((i) => i.kind === params.kind);

    items.sort((a, b) => {
      const ab = Math.max(Math.abs(a.receivable), Math.abs(a.payable));
      const bb = Math.max(Math.abs(b.receivable), Math.abs(b.payable));
      if (bb !== ab) return bb - ab;
      return a.partyId.localeCompare(b.partyId);
    });

    const total = items.length;
    const totals = items.reduce(
      (acc, r) => {
        acc.receivable += r.receivable;
        acc.payable += r.payable;
        return acc;
      },
      { receivable: 0, payable: 0 },
    );
    const start = (params.page - 1) * params.pageSize;
    const paged = items.slice(start, start + params.pageSize);
    return { items: paged, page: params.page, pageSize: params.pageSize, total, totals };
  }

  /** 依 partyId 解析 displayName 與 kind（前綴或 Customer/Supplier 查詢） */
  private async resolvePartyDisplayAndKind(
    partyIds: string[],
  ): Promise<Map<string, { displayName?: string; kind?: string }>> {
    const map = new Map<string, { displayName?: string; kind?: string }>();

    // Phase 2: prefer Party view when available (single source of truth)
    try {
      if (partyIds.length > 0) {
        const rows = await this.prisma.$queryRaw<{ partyId: string; kind: string; displayName: string }[]>(
          Prisma.sql`
            SELECT "partyId", "kind", "displayName"
            FROM "Party"
            WHERE "partyId" IN (${Prisma.join(partyIds)})
          `,
        );
        for (const r of rows) {
          map.set(r.partyId, { kind: r.kind, displayName: r.displayName });
        }
        // don't return early: keep legacy resolution for old partyIds (e.g. raw UUID) for backward compatibility
      }
    } catch {
      // ignore (view not migrated yet) and fallback to legacy resolution below
    }

    const refIds = new Set<string>();
    const prefixKinds = new Map<string, string>();
    for (const pid of partyIds) {
      if (pid.startsWith('customer:')) {
        prefixKinds.set(pid, 'customer');
        refIds.add(pid.slice(9));
      } else if (pid.startsWith('supplier:')) {
        prefixKinds.set(pid, 'supplier');
        refIds.add(pid.slice(9));
      } else {
        refIds.add(pid);
      }
    }
    const ids = Array.from(refIds);
    const [customers, suppliers] = await Promise.all([
      this.prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      this.prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    ]);
    const custById = new Map(customers.map((c) => [c.id, c.name]));
    const suppById = new Map(suppliers.map((s) => [s.id, s.name]));

    for (const pid of partyIds) {
      let refId: string;
      let kind: string | undefined;
      if (pid.startsWith('customer:')) {
        refId = pid.slice(9);
        kind = 'customer';
      } else if (pid.startsWith('supplier:')) {
        refId = pid.slice(9);
        kind = 'supplier';
      } else {
        refId = pid;
        if (custById.has(pid)) kind = 'customer';
        else if (suppById.has(pid)) kind = 'supplier';
      }
      const displayName = custById.get(refId) ?? suppById.get(refId);
      map.set(pid, { displayName, kind });
    }
    return map;
  }

  /** 關帳：是否有已關帳區間包含該日（occurredAt 的日期）。若表尚未 migrate 則回傳 false。 */
  async hasClosedPeriodContaining(occurredAt: Date, merchantId?: string | null): Promise<boolean> {
    try {
      const dayOnly = new Date(occurredAt);
      dayOnly.setUTCHours(0, 0, 0, 0);
      const where: { status: string; startDate: { lte: Date }; endDate: { gte: Date }; merchantId: string | null } = {
        status: 'CLOSED',
        startDate: { lte: dayOnly },
        endDate: { gte: dayOnly },
        merchantId: null,
      };
      if (merchantId?.trim()) where.merchantId = merchantId.trim();
      const count = await this.prisma.financePeriodClose.count({ where });
      return count > 0;
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? '';
      if (typeof msg === 'string' && (msg.includes('does not exist') || msg.includes('FinancePeriodClose'))) return false;
      throw e;
    }
  }

  /** 若 FinanceAuditLog 表尚未 migrate 則靜默略過。 */
  async createAuditLog(data: {
    eventId: string;
    actor?: string;
    source?: string;
    amount?: number;
    eventType?: string;
  }) {
    try {
      return await this.prisma.financeAuditLog.create({
        data: {
          eventId: data.eventId,
          actor: data.actor ?? null,
          source: data.source ?? 'API',
          amount: data.amount != null ? new Decimal(data.amount) : null,
          eventType: data.eventType ?? null,
        },
      });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? '';
      if (typeof msg === 'string' && (msg.includes('does not exist') || msg.includes('FinanceAuditLog'))) return null;
      throw e;
    }
  }

  async listPeriods(params: { merchantId?: string; status?: string }) {
    const where: { merchantId?: string; status?: string } = {};
    if (params.merchantId?.trim()) where.merchantId = params.merchantId.trim();
    if (params.status?.trim()) where.status = params.status.trim();
    return this.prisma.financePeriodClose.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
  }

  async createPeriod(data: {
    merchantId?: string;
    startDate: Date;
    endDate: Date;
    closedBy?: string;
  }) {
    return this.prisma.financePeriodClose.create({
      data: {
        merchantId: data.merchantId?.trim() || null,
        startDate: data.startDate,
        endDate: data.endDate,
        closedBy: data.closedBy ?? null,
        status: 'CLOSED',
      },
    });
  }

  async findPeriodById(id: string) {
    return this.prisma.financePeriodClose.findUnique({ where: { id } });
  }

  async unlockPeriod(id: string) {
    try {
      return await this.prisma.financePeriodClose.update({
        where: { id },
        data: { status: 'UNLOCKED' },
      });
    } catch (e) {
      const anyE = e as any;
      // tolerate concurrent deletion in test/CI runs
      if (anyE?.code === 'P2025') return null;
      throw e;
    }
  }

  async listAuditLog(params: {
    eventId?: string;
    from?: Date;
    to?: Date;
    actor?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: { eventId?: string; createdAt?: { gte?: Date; lte?: Date }; actor?: string } = {};
    if (params.eventId?.trim()) where.eventId = params.eventId.trim();
    if (params.actor?.trim()) where.actor = params.actor.trim();
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const [total, items] = await Promise.all([
      this.prisma.financeAuditLog.count({ where }),
      this.prisma.financeAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async upsertSnapshot(data: { asOfDate: Date; type: 'daily' | 'monthly'; path: string; summary: unknown }) {
    return this.prisma.financeSnapshot.upsert({
      where: { asOfDate_type: { asOfDate: data.asOfDate, type: data.type } },
      create: {
        asOfDate: data.asOfDate,
        type: data.type,
        path: data.path,
        summaryJson: data.summary as Prisma.JsonObject,
      },
      update: {
        path: data.path,
        summaryJson: data.summary as Prisma.JsonObject,
      },
    });
  }

  async listSnapshots(params: { type?: 'daily' | 'monthly'; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.FinanceSnapshotWhereInput = {};
    if (params.type) where.type = params.type;
    const [total, items] = await Promise.all([
      this.prisma.financeSnapshot.count({ where }),
      this.prisma.financeSnapshot.findMany({
        where,
        orderBy: [{ asOfDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async findSnapshotById(id: string) {
    if (!id?.trim()) return null;
    return this.prisma.financeSnapshot.findUnique({ where: { id: id.trim() } });
  }

  /** 檢查區間是否與既有關帳重疊（status=CLOSED） */
  async hasOverlappingClosedPeriod(
    startDate: Date,
    endDate: Date,
    merchantId?: string | null,
  ): Promise<boolean> {
    const where: {
      status: string;
      startDate: { lte: Date };
      endDate: { gte: Date };
      merchantId?: string | null;
    } = {
      status: 'CLOSED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };
    if (merchantId?.trim()) where.merchantId = merchantId.trim();
    const count = await this.prisma.financePeriodClose.count({ where });
    return count > 0;
  }
}
