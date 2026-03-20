import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceEvent, FinanceEventType } from '@prisma/client';
import { FinanceRepository } from '../infrastructure/finance.repository';

export type FinanceEventRow = {
  id: string;
  type: FinanceEventType;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount: number | null;
  occurredAt: Date;
  referenceId: string | null;
  referenceKind: 'posOrder' | 'receivingNote' | 'unknown';
  note: string | null;
  createdAt: Date;
};

function inferReferenceKind(e: FinanceEvent): 'posOrder' | 'receivingNote' | 'unknown' {
  if (!e.referenceId) return 'unknown';
  if (e.type === 'SALE_RECEIVABLE' || e.type === 'SALE_PAYMENT' || e.type === 'SALE_REFUND') return 'posOrder';
  if (e.type === 'PURCHASE_PAYABLE' || e.type === 'PURCHASE_RETURN' || e.type === 'PURCHASE_REBATE') return 'receivingNote';
  return 'unknown';
}

function toRow(e: FinanceEvent): FinanceEventRow {
  return {
    id: e.id,
    type: e.type,
    partyId: e.partyId,
    currency: e.currency,
    amount: Number(e.amount),
    taxAmount: e.taxAmount != null ? Number(e.taxAmount) : null,
    occurredAt: e.occurredAt,
    referenceId: e.referenceId,
    referenceKind: inferReferenceKind(e),
    note: e.note,
    createdAt: e.createdAt,
  };
}

export interface RecordFinanceEventInput {
  type: FinanceEventType;
  partyId?: string | null;
  currency: string;
  amount: number;
  taxAmount?: number;
  occurredAt?: string;
  referenceId?: string;
  note?: string;
}

const VALID_FINANCE_EVENT_TYPES: FinanceEventType[] = [
  'SALE_RECEIVABLE',
  'SALE_PAYMENT',
  'SALE_REFUND',
  'PURCHASE_PAYABLE',
  'PURCHASE_REBATE',
  'PURCHASE_RETURN',
  'ADJUSTMENT',
];

@Injectable()
export class FinanceService {
  constructor(private readonly repo: FinanceRepository) {}

  async recordFinanceEvent(input: RecordFinanceEventInput, opts?: { actor?: string; source?: string }) {
    if (!VALID_FINANCE_EVENT_TYPES.includes(input.type)) {
      throw new BadRequestException({
        message: 'Unsupported FinanceEventType',
        code: 'FINANCE_UNSUPPORTED_EVENT_TYPE',
      });
    }
    if (!input.currency?.trim()) {
      throw new BadRequestException({
        message: 'currency is required',
        code: 'FINANCE_CURRENCY_REQUIRED',
      });
    }
    if (typeof input.amount !== 'number' || Number.isNaN(input.amount)) {
      throw new BadRequestException({
        message: 'amount must be a number',
        code: 'FINANCE_AMOUNT_INVALID',
      });
    }

    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const partyId = input.partyId != null && input.partyId !== '' ? input.partyId : '';

    const closed = await this.repo.hasClosedPeriodContaining(occurredAt);
    if (closed) {
      throw new BadRequestException({
        message: 'Finance period is closed for this date',
        code: 'FINANCE_PERIOD_CLOSED',
      });
    }

    const created = await this.repo.appendEvent({
      type: input.type,
      partyId,
      currency: input.currency.trim(),
      amount: input.amount,
      taxAmount: input.taxAmount,
      occurredAt,
      referenceId: input.referenceId,
      note: input.note,
    });

    await this.repo.createAuditLog({
      eventId: created.id,
      actor: opts?.actor,
      source: opts?.source ?? 'API',
      amount: input.amount,
      eventType: input.type,
    });

    return toRow(created);
  }

  async listFinanceEvents(q: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: string;
    to?: string;
    /** 僅在未帶 from 且未帶 to 時生效：`last30d` = 近 30 日（報表預設，不破壞既有不帶參行為） */
    preset?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = q.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
    if (page < 1 || pageSize < 1) {
      throw new BadRequestException({
        message: 'page must be >= 1, pageSize between 1 and 100',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    let from = q.from ? new Date(q.from) : undefined;
    let to = q.to ? new Date(q.to) : undefined;
    if (
      q.preset === 'last30d' &&
      !q.from?.trim() &&
      !q.to?.trim()
    ) {
      to = new Date();
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({
        message: 'invalid from',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'invalid to',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    const { items, total } = await this.repo.listEvents({
      partyId: q.partyId,
      referenceId: q.referenceId,
      type: q.type,
      from,
      to,
      page,
      pageSize,
    });
    return {
      items: items.map(toRow),
      page,
      pageSize,
      total,
    };
  }

  private csvCell(v: string | number | null | undefined): string {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /**
   * 金流 CSV：query 與 listFinanceEvents 相同（partyId、referenceId、type、from、to、preset=last30d）；最多 1 萬列
   */
  async exportFinanceEventsCsv(q: {
    partyId?: string;
    referenceId?: string;
    type?: FinanceEventType;
    from?: string;
    to?: string;
    preset?: string;
  }): Promise<string> {
    let from = q.from ? new Date(q.from) : undefined;
    let to = q.to ? new Date(q.to) : undefined;
    if (
      q.preset === 'last30d' &&
      !q.from?.trim() &&
      !q.to?.trim()
    ) {
      to = new Date();
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({
        message: 'invalid from',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'invalid to',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    const rows = await this.repo.listEventsExport({
      partyId: q.partyId,
      referenceId: q.referenceId,
      type: q.type,
      from,
      to,
    });
    const header = [
      'id',
      'type',
      'partyId',
      'currency',
      'amount',
      'taxAmount',
      'occurredAt',
      'referenceId',
      'note',
      'createdAt',
    ].join(',');
    const lines = rows.map((r) =>
      [
        this.csvCell(r.id),
        this.csvCell(r.type),
        this.csvCell(r.partyId),
        this.csvCell(r.currency),
        this.csvCell(Number(r.amount)),
        this.csvCell(r.taxAmount != null ? Number(r.taxAmount) : ''),
        this.csvCell(r.occurredAt.toISOString()),
        this.csvCell(r.referenceId),
        this.csvCell(r.note),
        this.csvCell(r.createdAt.toISOString()),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  /**
   * 金流彙總：依 type 或 partyId 加總區間內金額。
   * Query：from、to、preset=last30d（未帶 from/to 時）、groupBy=type｜partyId。
   */
  async getSummary(q: {
    from?: string;
    to?: string;
    preset?: string;
    groupBy: 'type' | 'partyId' | 'day' | 'week';
  }) {
    let from = q.from ? new Date(q.from) : undefined;
    let to = q.to ? new Date(q.to) : undefined;
    if (
      q.preset === 'last30d' &&
      !q.from?.trim() &&
      !q.to?.trim()
    ) {
      to = new Date();
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException({
        message: 'invalid from',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException({
        message: 'invalid to',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    if (q.groupBy === 'type') {
      return this.repo.summaryByType({ from, to });
    }
    if (q.groupBy === 'partyId') {
      return this.repo.summaryByPartyId({ from, to });
    }
    if (q.groupBy === 'day') {
      return this.repo.summaryTrend({ from, to, bucket: 'day' });
    }
    return this.repo.summaryTrend({ from, to, bucket: 'week' });
  }

  /**
   * GET /finance/balances — Phase 4 應收／應付餘額（依事件表重算；回傳 displayName、kind；支援 kind 篩選）
   */
  async getBalances(q: {
    merchantId: string;
    partyId?: string;
    kind?: 'customer' | 'supplier';
    page?: number;
    pageSize?: number;
  }): Promise<{
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
    const kind =
      q.kind === 'customer'
        ? ('customer' as const)
        : q.kind === 'supplier'
          ? ('supplier' as const)
          : undefined;
    const page = q.page ?? 1;
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
    if (page < 1 || pageSize < 1) {
      throw new BadRequestException({
        message: 'page must be >= 1, pageSize between 1 and 100',
        code: 'FINANCE_LIST_PAGE_INVALID',
      });
    }
    return this.repo.balancesByPartyId({
      merchantId: q.merchantId,
      partyId: q.partyId,
      kind,
      page,
      pageSize,
    });
  }

  async listPeriods(q: { merchantId?: string; status?: string }) {
    return this.repo.listPeriods({
      merchantId: q.merchantId?.trim(),
      status: q.status?.trim(),
    });
  }

  async closePeriod(body: { startDate: string; endDate: string; merchantId?: string; closedBy?: string }) {
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        code: 'FINANCE_PERIOD_OVERLAP',
        message: 'Invalid startDate or endDate',
      });
    }
    if (start > end) {
      throw new BadRequestException({
        code: 'FINANCE_PERIOD_OVERLAP',
        message: 'startDate must be before endDate',
      });
    }
    const overlapping = await this.repo.hasOverlappingClosedPeriod(start, end, body.merchantId?.trim());
    if (overlapping) {
      throw new BadRequestException({
        code: 'FINANCE_PERIOD_ALREADY_CLOSED',
        message: 'Period overlaps with an already closed period',
      });
    }
    return this.repo.createPeriod({
      merchantId: body.merchantId?.trim(),
      startDate: start,
      endDate: end,
      closedBy: body.closedBy?.trim(),
    });
  }

  async unlockPeriod(id: string) {
    const periodId = id?.trim();
    if (!periodId) {
      return { ok: true, skipped: true };
    }
    const unlocked = await this.repo.unlockPeriod(periodId);
    if (!unlocked) return { ok: true, skipped: true };
    return unlocked;
  }

  async listAuditLog(q: { eventId?: string; from?: string; to?: string; actor?: string; page?: number; pageSize?: number }) {
    let from: Date | undefined;
    let to: Date | undefined;
    if (q.from) from = new Date(q.from);
    if (q.to) to = new Date(q.to);
    return this.repo.listAuditLog({
      eventId: q.eventId?.trim(),
      from,
      to,
      actor: q.actor?.trim(),
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  /**
   * POST /finance/snapshots — 產出 asOfDate 的 summary 快照；type daily|monthly；寫入本地或 S3（依設定）
   */
  async createSnapshot(body: { asOfDate: string; type: 'daily' | 'monthly' }) {
    const asOf = new Date(body.asOfDate);
    if (Number.isNaN(asOf.getTime())) {
      throw new BadRequestException({
        code: 'FINANCE_AMOUNT_INVALID',
        message: 'Invalid asOfDate',
      });
    }
    const type = body.type === 'monthly' ? 'monthly' : 'daily';
    let from: Date;
    let to: Date;
    if (type === 'monthly') {
      from = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
      to = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      from = new Date(asOf);
      from.setUTCHours(0, 0, 0, 0);
      to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      to.setMilliseconds(-1);
    }
    const [byType, byParty] = await Promise.all([
      this.repo.summaryByType({ from, to }),
      this.repo.summaryByPartyId({ from, to }),
    ]);
    const payload = {
      asOfDate: asOf.toISOString().slice(0, 10),
      type,
      generatedAt: new Date().toISOString(),
      byType,
      byParty,
    };
    const path = `finance/YYYY-MM-DD.json`.replace('YYYY-MM-DD', asOf.toISOString().slice(0, 10));
    const resolvedPath = type === 'monthly' ? path.replace('.json', '-monthly.json') : path;
    const saved = await this.repo.upsertSnapshot({
      asOfDate: new Date(payload.asOfDate),
      type,
      path: resolvedPath,
      summary: payload,
    });
    return {
      id: saved.id,
      asOfDate: payload.asOfDate,
      type,
      path: resolvedPath,
      generatedAt: payload.generatedAt,
      summary: payload,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async listSnapshots(q: { type?: 'daily' | 'monthly'; page?: number; pageSize?: number }) {
    const type = q.type === 'monthly' ? 'monthly' : q.type === 'daily' ? 'daily' : undefined;
    const out = await this.repo.listSnapshots({ type, page: q.page, pageSize: q.pageSize });
    return {
      items: out.items.map((s) => ({
        id: s.id,
        asOfDate: s.asOfDate.toISOString().slice(0, 10),
        type: s.type,
        path: s.path,
        createdAt: s.createdAt.toISOString(),
      })),
      page: out.page,
      pageSize: out.pageSize,
      total: out.total,
    };
  }

  async getSnapshotById(id: string) {
    const row = await this.repo.findSnapshotById(id);
    if (!row) {
      throw new NotFoundException({
        code: 'FINANCE_SNAPSHOT_NOT_FOUND',
        message: 'Snapshot not found',
      });
    }
    const summary = row.summaryJson as any;
    const generatedAt =
      summary && typeof summary === 'object' && typeof summary.generatedAt === 'string'
        ? summary.generatedAt
        : row.createdAt.toISOString();
    return {
      id: row.id,
      asOfDate: row.asOfDate.toISOString().slice(0, 10),
      type: row.type,
      path: row.path,
      generatedAt,
      summary,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
