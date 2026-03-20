/**
 * financeApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';


/** GET /finance/periods — 關帳區間列表 */
export interface FinancePeriodRow {
  id: string;
  startDate: string;
  endDate: string;
  closedAt: string;
  status: string;
}
export async function listFinancePeriods(
  params?: { merchantId?: string; status?: string },
): Promise<{ items: FinancePeriodRow[] } | ApiError> {
  const q = new URLSearchParams();
  if (params?.merchantId) q.set('merchantId', params.merchantId);
  if (params?.status) q.set('status', params.status);
  const path = q.toString() ? `finance/periods?${q}` : 'finance/periods';
  const out = await request<FinancePeriodRow[] | { items: FinancePeriodRow[] }>(path);
  if (!out.ok) return out.error;
  const items = Array.isArray(out.data) ? out.data : out.data.items;
  return { items };
}

/** POST /finance/periods/close — 關帳 */
export async function closeFinancePeriod(body: {
  startDate: string;
  endDate: string;
  merchantId?: string;
}): Promise<FinancePeriodRow | ApiError> {
  const out = await request<FinancePeriodRow>('finance/periods/close', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /finance/periods/:id/unlock — 解鎖關帳 */
export async function unlockFinancePeriod(periodId: string): Promise<void | ApiError> {
  const out = await request<unknown>(`finance/periods/${encodeURIComponent(periodId)}/unlock`, {
    method: 'POST',
  });
  if (!out.ok) return out.error;
}

/** GET /finance/audit-log — 稽核紀錄（與後端 FinanceAuditLog 對齊：eventType, createdAt） */
export interface FinanceAuditLogRow {
  id: string;
  eventId: string;
  eventType?: string;
  createdAt?: string;
  actor?: string;
  source?: string;
  amount?: string | number;
}
export async function listFinanceAuditLog(params: {
  eventId?: string;
  from?: string;
  to?: string;
  actor?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: FinanceAuditLogRow[]; total?: number } | ApiError> {
  const q = new URLSearchParams();
  if (params.eventId) q.set('eventId', params.eventId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.actor) q.set('actor', params.actor);
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = q.toString() ? `finance/audit-log?${q}` : 'finance/audit-log';
  const out = await request<{ items: FinanceAuditLogRow[]; total?: number }>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /finance/snapshots — 快照列表（Admin key） */
export interface FinanceSnapshotRow {
  id: string;
  asOfDate: string;
  type: 'daily' | 'monthly';
  path: string;
  createdAt: string;
}

/** POST /finance/snapshots — 產出快照（Admin key） */
export async function createFinanceSnapshot(body: {
  asOfDate: string;
  type: 'daily' | 'monthly';
}): Promise<{ id: string } | ApiError> {
  const out = await request<{ id: string }>('finance/snapshots', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  const d = out.data as unknown as { id?: unknown };
  return { id: String(d.id ?? '') };
}

export async function listFinanceSnapshots(params: {
  type?: 'daily' | 'monthly';
  page?: number;
  pageSize?: number;
}): Promise<{ items: FinanceSnapshotRow[]; page: number; pageSize: number; total: number } | ApiError> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = q.toString() ? `finance/snapshots?${q}` : 'finance/snapshots';
  const out = await request<{ items: FinanceSnapshotRow[]; page: number; pageSize: number; total: number }>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /finance/snapshots/:id — 單筆快照（Admin key） */
export async function getFinanceSnapshotById(
  id: string,
): Promise<
  | {
      id: string;
      asOfDate: string;
      type: 'daily' | 'monthly';
      path: string;
      generatedAt?: string;
      summary?: unknown;
      createdAt: string;
    }
  | ApiError
> {
  const out = await request<{
    id: string;
    asOfDate: string;
    type: 'daily' | 'monthly';
    path: string;
    generatedAt?: string;
    summary?: unknown;
    createdAt: string;
  }>(`finance/snapshots/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /finance/snapshots/:id/download — 下載快照 JSON（Admin key；後端回 application/json） */
export async function downloadFinanceSnapshot(id: string): Promise<true | ApiError> {
  const traceId = genTraceId();
  const path = `finance/snapshots/${encodeURIComponent(id)}/download`;
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    return {
      statusCode: 0,
      message: (e as Error)?.message ?? 'Failed to fetch',
      traceId,
      code: 'NETWORK_ERROR',
    };
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { message?: string; code?: string };
      if (j?.message) message = j.message;
      return { statusCode: res.status, message, traceId, code: j?.code };
    } catch {
      return { statusCode: res.status, message, traceId };
    }
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finance-snapshot-${id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export interface FinanceEventRow {
  id: string;
  type: string;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount: number | null;
  occurredAt: string;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface PagedFinanceEvents {
  items: FinanceEventRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** GET /finance/events — 公開；preset=last30d 近 30 日；可選 partyId 依對象篩選 */
export async function getFinanceEvents(params?: {
  preset?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  type?: string;
  partyId?: string;
}): Promise<PagedFinanceEvents | ApiError> {
  const q = new URLSearchParams();
  if (params?.preset) q.set('preset', params.preset);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params?.type) q.set('type', params.type);
  if (params?.partyId != null && params.partyId.trim() !== '') q.set('partyId', params.partyId.trim());
  const qs = q.toString();
  const out = await request<PagedFinanceEvents>(qs ? `finance/events?${qs}` : 'finance/events');
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /finance/summary — 依 type、partyId、day、week 彙總區間內金額 */
export type FinanceSummaryByType = { byType: Record<string, number> };
export type FinanceSummaryByPartyId = {
  byParty: Array<{ partyId: string; amountsByType: Record<string, number>; displayName?: string }>;
};
/** groupBy=day|week 時後端回傳 */
export type FinanceSummaryTrend = {
  bucket: 'day' | 'week';
  items: { periodStart: string; amountsByType: Record<string, number> }[];
};

/** GET /finance/balances — 應收／應付餘額（Phase 4）；query 可選 partyId、kind=customer|supplier */
export interface FinanceBalanceItem {
  partyId: string;
  receivable: number;
  payable: number;
  displayName?: string;
  kind?: string;
}

export async function getFinanceBalances(params?: {
  merchantId?: string;
  partyId?: string;
  kind?: 'customer' | 'supplier';
}): Promise<{ items: FinanceBalanceItem[] } | ApiError> {
  const q = new URLSearchParams();
  if (params?.merchantId?.trim()) q.set('merchantId', params.merchantId.trim());
  if (params?.partyId != null && params.partyId.trim() !== '') q.set('partyId', params.partyId.trim());
  if (params?.kind) q.set('kind', params.kind);
  const qs = q.toString();
  const out = await request<{ items: FinanceBalanceItem[] }>(qs ? `finance/balances?${qs}` : 'finance/balances');
  if (!out.ok) return out.error;
  return out.data;
}

export async function getFinanceSummary(params: {
  preset?: string;
  from?: string;
  to?: string;
  groupBy: 'type' | 'partyId' | 'day' | 'week';
}): Promise<FinanceSummaryByType | FinanceSummaryByPartyId | FinanceSummaryTrend | ApiError> {
  const q = new URLSearchParams();
  if (params.preset) q.set('preset', params.preset);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('groupBy', params.groupBy);
  const out = await request<FinanceSummaryByType | FinanceSummaryByPartyId | FinanceSummaryTrend>(
    `finance/summary?${q.toString()}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}
