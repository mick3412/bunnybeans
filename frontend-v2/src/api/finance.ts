import { api, type ApiError } from './client';

const BASE =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? '' : '');
const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

function traceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

export type FinanceEventRow = {
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
};

export interface PagedFinanceEvents {
  items: FinanceEventRow[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getFinanceEvents(params?: {
  preset?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<PagedFinanceEvents | ApiError> {
  const q = new URLSearchParams();
  if (params?.preset) q.set('preset', params.preset);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params?.type) q.set('type', params.type);
  const path = q.toString() ? `finance/events?${q}` : 'finance/events';
  const out = await api<PagedFinanceEvents>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /finance/events/export — 下載 CSV，需 Admin Key */
export async function exportFinanceEventsCsv(params?: {
  preset?: string;
  from?: string;
  to?: string;
  type?: string;
}): Promise<true | ApiError> {
  const q = new URLSearchParams();
  if (params?.preset) q.set('preset', params.preset);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.type) q.set('type', params.type);
  const url = `${BASE.replace(/\/$/, '')}/finance/events/export?${q.toString()}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId() };
  if (ADMIN_KEY) headers['X-Admin-Key'] = ADMIN_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) message = j.message;
    } catch {
      /* ignore */
    }
    return { statusCode: res.status, message };
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'finance-events.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export type FinanceSummaryByType = { byType: Record<string, number> };

export async function getFinanceSummary(params: {
  from?: string;
  to?: string;
  preset?: string;
  groupBy: 'type' | 'partyId';
}): Promise<FinanceSummaryByType | ApiError> {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.preset) q.set('preset', params.preset);
  q.set('groupBy', params.groupBy);
  const out = await api<FinanceSummaryByType>(`finance/summary?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

function todayStartEnd(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function weekStartEnd(): { from: string; to: string } {
  const to = new Date();
  const day = to.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const from = new Date(to);
  from.setDate(from.getDate() - diff);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function sumRelevant(byType: Record<string, number>): number {
  const sale = byType['SALE_PAYMENT'] ?? 0;
  const receivable = byType['SALE_RECEIVABLE'] ?? 0;
  const refund = byType['SALE_REFUND'] ?? 0;
  return sale + receivable - refund;
}

export async function getFinanceSummaryToday(): Promise<{ total: number } | ApiError> {
  const { from, to } = todayStartEnd();
  const res = await getFinanceSummary({ from, to, groupBy: 'type' });
  if ('statusCode' in res) return res;
  return { total: sumRelevant(res.byType) };
}

export async function getFinanceSummaryWeek(): Promise<{ total: number } | ApiError> {
  const { from, to } = weekStartEnd();
  const res = await getFinanceSummary({ from, to, groupBy: 'type' });
  if ('statusCode' in res) return res;
  return { total: sumRelevant(res.byType) };
}
