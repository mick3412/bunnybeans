/**
 * opsApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

/** GET /ops/jobs — OpsJobRunLog 列表（分頁、kind 篩選） */
export interface OpsJobRunLogItem {
  id: string;
  jobType: string;
  lastRunAt: string;
  success: boolean;
  message: string | null;
  createdAt: string;
}
export async function listOpsJobs(params?: {
  page?: number;
  pageSize?: number;
  kind?: string;
  from?: string;
  to?: string;
}): Promise<
  { items: OpsJobRunLogItem[]; total: number } | ApiError
> {
  const q = new URLSearchParams();
  if (params?.page != null && params.page > 0) q.set('page', String(params.page));
  if (params?.pageSize != null && params.pageSize > 0) q.set('pageSize', String(params.pageSize));
  if (params?.kind?.trim()) q.set('kind', params.kind.trim());
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  const path = q.toString() ? `ops/jobs?${q}` : 'ops/jobs';
  const out = await request<{ items: OpsJobRunLogItem[]; total: number }>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /ops/jobs/status — 各 job 類型最近一次執行狀態 */
export interface OpsJobStatusItem {
  jobType: string;
  lastRunAt: string | null;
  success: boolean;
  message: string | null;
}
export async function getOpsJobsStatus(): Promise<
  { items: OpsJobStatusItem[] } | ApiError
> {
  const out = await request<{ items: OpsJobStatusItem[] }>('ops/jobs/status');
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /ops/references/resolve — 解析跨模組 referenceId */
export async function resolveOpsReference(
  referenceId: string,
): Promise<{ referenceId: string; kind: 'posOrder' | 'receivingNote' | 'unknown' } | ApiError> {
  const q = new URLSearchParams({ referenceId: referenceId.trim() });
  const out = await request<{ referenceId: string; kind: 'posOrder' | 'receivingNote' | 'unknown' }>(
    `ops/references/resolve?${q}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /ops/jobs/run — 手動補跑（Admin key） */
export async function runOpsJob(body: {
  kind: 'crm-run-scheduled' | 'finance-snapshot';
  asOfDate?: string;
  snapshotType?: 'daily' | 'monthly';
}): Promise<{ ok: true; kind: string; runLogId?: string; result: unknown } | ApiError> {
  const out = await request<{ ok: true; kind: string; runLogId?: string; result: unknown }>('ops/jobs/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /ops/reports/click-audit — 報表穿透點擊審計列表（Admin key） */
export interface ReportClickAuditRow {
  id: string;
  merchantId: string | null;
  source: string;
  field: string;
  referenceId: string;
  resultCode?: string | null;
  fixHint?: 'DATA_MISSING' | 'NEEDS_DISAMBIGUATION' | 'PERMISSION' | 'OK';
  resolvedKind: string;
  success: boolean;
  createdAt: string;
}

/** POST /ops/reports/click-audit — 穿透點擊上報（Admin key） */
export async function reportClickAudit(body: {
  merchantId?: string;
  source: string;
  field?: string;
  referenceId: string;
  resultCode?: 'NOT_FOUND' | 'MULTI_MATCH' | 'NAVIGATED' | string;
}): Promise<
  | { id: string; resolvedKind: 'posOrder' | 'receivingNote' | 'unknown'; success: boolean; createdAt: string }
  | ApiError
> {
  const out = await request<{ id: string; resolvedKind: 'posOrder' | 'receivingNote' | 'unknown'; success: boolean; createdAt: string }>(
    'ops/reports/click-audit',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}
export async function listReportClickAudit(params: {
  from?: string;
  to?: string;
  source?: string;
  resolvedKind?: string;
  resultCode?: string;
  success?: boolean;
  referenceId?: string;
  page?: number;
  pageSize?: number;
  order?: 'asc' | 'desc';
}): Promise<{ items: ReportClickAuditRow[]; page: number; pageSize: number; total: number } | ApiError> {
  const q = new URLSearchParams();
  if (params.from?.trim()) q.set('from', params.from.trim());
  if (params.to?.trim()) q.set('to', params.to.trim());
  if (params.source?.trim()) q.set('source', params.source.trim());
  if (params.resolvedKind?.trim()) q.set('resolvedKind', params.resolvedKind.trim());
  if (params.resultCode?.trim()) q.set('resultCode', params.resultCode.trim());
  if (params.referenceId?.trim()) q.set('referenceId', params.referenceId.trim());
  if (params.success !== undefined) q.set('success', params.success ? 'true' : 'false');
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params.order) q.set('order', params.order);
  const path = q.toString() ? `ops/reports/click-audit?${q}` : 'ops/reports/click-audit';
  const out = await request<{ items: ReportClickAuditRow[]; page: number; pageSize: number; total: number }>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /ops/reports/click-audit/summary — 報表穿透點擊審計彙總（Admin key） */
export async function summaryReportClickAudit(params: {
  from?: string;
  to?: string;
  source?: string;
  resolvedKind?: string;
  resultCode?: string;
  success?: boolean;
}): Promise<
  | {
      total: number;
      bySuccess: { success: boolean; count: number }[];
      bySource: { source: string; count: number }[];
      byResultCode?: { resultCode: string | null; count: number }[];
      byResolvedKind: { resolvedKind: string; count: number }[];
      topSources?: { source: string; notFound: number; multiMatch: number; total: number }[];
      trendByDay?: { day: string; total: number; failed: number }[];
      topReferenceIds?: { field: string; referenceId: string; count: number }[];
    }
  | ApiError
> {
  const q = new URLSearchParams();
  if (params.from?.trim()) q.set('from', params.from.trim());
  if (params.to?.trim()) q.set('to', params.to.trim());
  if (params.source?.trim()) q.set('source', params.source.trim());
  if (params.resolvedKind?.trim()) q.set('resolvedKind', params.resolvedKind.trim());
  if (params.resultCode?.trim()) q.set('resultCode', params.resultCode.trim());
  if (params.success !== undefined) q.set('success', params.success ? 'true' : 'false');
  const path = q.toString() ? `ops/reports/click-audit/summary?${q}` : 'ops/reports/click-audit/summary';
  const out = await request<{
    total: number;
    bySuccess: { success: boolean; count: number }[];
    bySource: { source: string; count: number }[];
    byResultCode?: { resultCode: string | null; count: number }[];
    byResolvedKind: { resolvedKind: string; count: number }[];
    topSources?: { source: string; notFound: number; multiMatch: number; total: number }[];
    trendByDay?: { day: string; total: number; failed: number }[];
    topReferenceIds?: { field: string; referenceId: string; count: number }[];
  }>(path);
  if (!out.ok) return out.error;
  return out.data;
}
