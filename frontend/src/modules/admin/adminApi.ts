/**
 * Admin 後台 API — 依 docs/admin-inventory-ui.md、api-design-inventory-finance.md
 */
/** 未設 VITE_API_BASE_URL 時，dev 預設打本機後端，避免 fetch 打到 Vite:5173 出現 Cannot GET */
const BASE_URL =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3003' : '');
const ADMIN_API_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

/** 與後端 AdminApiKeyGuard 一致：僅受保護的寫入需帶 X-Admin-Key */
function needsAdminKey(path: string, method: string): boolean {
  const m = (method || 'GET').toUpperCase();
  const p = path.replace(/^\//, '');
  if (p === 'inventory/events' && m === 'POST') return true;
  if (p === 'inventory/transfer' && m === 'POST') return true;
  if (p === 'inventory/events/batch-stocktake' && m === 'POST') return true;
  if (p === 'products' && m === 'POST') return true;
  if (p === 'products/import' && m === 'POST') return true;
  if (p === 'products/batch-price' && m === 'PATCH') return true;
  if (p.startsWith('products/') && (m === 'PATCH' || m === 'DELETE')) return true;
  if (p === 'categories' && m === 'POST') return true;
  if (/^categories\/.+/.test(p) && m === 'PATCH') return true;
  if (/^categories\/.+/.test(p) && m === 'DELETE') return true;
  if (p === 'brands' && m === 'POST') return true;
  if (/^brands\/.+/.test(p) && m === 'PATCH') return true;
  if (/^brands\/.+/.test(p) && m === 'DELETE') return true;
  if (p === 'promotion-rules' && m === 'POST') return true;
  if (p === 'promotion-rules/reorder/bulk' && m === 'PATCH') return true;
  if (/^promotion-rules\/.+/.test(p) && m === 'PATCH') return true;
  if (/^promotion-rules\/.+/.test(p) && m === 'DELETE') return true;
  if (p === 'inventory/balances/export' && m === 'GET') return true;
  if (p === 'finance/events/export' && m === 'GET') return true;
  if (p === 'inventory/events/export' && m === 'GET') return true;
  const pathOnly = p.split('?')[0];
  if (pathOnly === 'pos/orders/export' && m === 'GET') return true;
  if (pathOnly === 'inventory/events/import' && m === 'POST') return true;
  if (pathOnly === 'customers/import/preview' && m === 'POST') return true;
  if (pathOnly === 'customers/import/apply' && m === 'POST') return true;
  if (m === 'POST' && /^imports\/jobs\/(products_csv|inventory_csv)$/.test(pathOnly)) return true;
  if (m === 'GET' && /^imports\/jobs\/.+/.test(pathOnly)) return true;
  if (pathOnly === 'loyalty/settings' && m === 'PATCH') return true;
  if (pathOnly === 'loyalty/coupons' && m === 'POST') return true;
  if (m === 'PATCH' && /^loyalty\/coupons\/.+/.test(pathOnly)) return true;
  if (pathOnly === 'customers' && m === 'POST') return true;
  if (m === 'GET' && /^customers\/[^/]+$/.test(pathOnly)) return true;
  if (m === 'PATCH' && /^customers\/[^/]+$/.test(pathOnly)) return true;
  if (pathOnly === 'customers/merge' && m === 'POST') return true;
  if (m === 'POST' && /^customers\/[^/]+\/contacts$/.test(pathOnly)) return true;
  if (pathOnly === 'merchant/current' && m === 'GET') return true;
  if (pathOnly === 'crm/segments' && m === 'GET') return true;
  if (m === 'GET' && /^crm\/segments\/[^/]+\/export$/.test(pathOnly)) return true;
  if (m === 'POST' && /^crm\/jobs\/[^/]+$/.test(pathOnly)) return true;
  if (m === 'GET' && /^crm\/jobs\/[^/]+$/.test(pathOnly)) return true;
  if (pathOnly === 'loyalty/reports/activity' && m === 'GET') return true;
  if (pathOnly === 'loyalty/reports/members' && m === 'GET') return true;
  if (pathOnly === 'finance/periods' && m === 'GET') return true;
  if (pathOnly === 'finance/periods/close' && m === 'POST') return true;
  if (m === 'POST' && /^finance\/periods\/[^/]+\/unlock$/.test(pathOnly)) return true;
  if (pathOnly === 'finance/audit-log' && m === 'GET') return true;
  if (pathOnly === 'finance/snapshots' && m === 'GET') return true;
  if (m === 'GET' && /^finance\/snapshots\/[^/]+$/.test(pathOnly)) return true;
  if (m === 'GET' && /^finance\/snapshots\/[^/]+\/download$/.test(pathOnly)) return true;
  if (pathOnly === 'crm/dispatch-rules' && (m === 'GET' || m === 'POST')) return true;
  if ((m === 'PATCH' || m === 'DELETE') && /^crm\/dispatch-rules\/[^/]+$/.test(pathOnly)) return true;
  if (pathOnly === 'product-tags' && m === 'POST') return true;
  if (m === 'PATCH' && /^product-tags\/[^/]+$/.test(pathOnly)) return true;
  if (m === 'DELETE' && /^product-tags\/[^/]+$/.test(pathOnly)) return true;
  if (pathOnly === 'purchase-orders/from-replenishment' && m === 'POST') return true;
  if (pathOnly === 'ops/jobs/run' && m === 'POST') return true;
  if (pathOnly === 'ops/reports/click-audit' && m === 'POST') return true;
  if (pathOnly === 'ops/reports/click-audit' && m === 'GET') return true;
  if (pathOnly === 'ops/reports/click-audit/summary' && m === 'GET') return true;
  return false;
}

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

/** CSV 下載（後端回 text/csv，非 JSON） */
export async function fetchCsvExport(
  pathWithQuery: string,
  filename: string,
): Promise<true | ApiError> {
  const traceId = genTraceId();
  const path = pathWithQuery.replace(/^\//, '');
  const url = `${BASE_URL.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) message = j.message;
    } catch {
      /* ignore */
    }
    return { statusCode: res.status, message, traceId };
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

/** 分群名單匯出 CSV（GET /crm/segments/:id/export，需 Admin Key） */
export async function exportSegmentCsv(segmentId: string): Promise<true | ApiError> {
  const path = `crm/segments/${encodeURIComponent(segmentId)}/export`;
  return fetchCsvExport(path, 'segment-members.csv');
}

/** GET /crm/segments — 分群列表（merchantId 必填、page、pageSize） */
export interface SegmentRow {
  id: string;
  name: string;
  merchantId: string;
  conditions: unknown;
  createdAt: string;
  updatedAt?: string;
}
export async function listSegments(
  merchantId: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: SegmentRow[]; total: number } | ApiError> {
  const q = new URLSearchParams({ merchantId, page: String(page), pageSize: String(pageSize) });
  const out = await request<{ items: SegmentRow[]; total: number }>(`crm/segments?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /crm/segments/:id/preview — 預覽符合人數 */
export async function getSegmentPreview(
  segmentId: string,
): Promise<{ customerIds: string[]; count: number } | ApiError> {
  const out = await request<{ customerIds: string[]; count: number }>(
    `crm/segments/${encodeURIComponent(segmentId)}/preview`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /crm/jobs/:kind — 分群發券，202 { jobId } */
export async function createCrmJob(
  kind: string,
  body: { merchantId: string; segmentId: string; couponId?: string; couponCode?: string },
): Promise<{ jobId: string } | ApiError> {
  const out = await request<{ jobId: string }>(`crm/jobs/${encodeURIComponent(kind)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /crm/jobs/:id — job 狀態 */
export interface CrmJobResult {
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: { sent: number; skipped: number; errors?: string[] };
  error?: string;
}
export async function getCrmJob(jobId: string): Promise<CrmJobResult | ApiError> {
  const out = await request<CrmJobResult>(`crm/jobs/${encodeURIComponent(jobId)}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /crm/jobs — 歷史列表（merchantId 必填、kind/from/to/page/pageSize） */
export interface CrmJobListItem {
  id: string;
  merchantId: string;
  kind: string;
  status: 'pending' | 'running' | 'done' | 'failed' | string;
  createdAt: string;
  segmentId: string;
  couponId: string;
}
export interface CrmJobListResponse {
  items: CrmJobListItem[];
  total: number;
  page: number;
  pageSize: number;
}
export async function listCrmJobs(params: {
  merchantId: string;
  kind?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<CrmJobListResponse | ApiError> {
  const q = new URLSearchParams({ merchantId: params.merchantId.trim() });
  if (params.kind?.trim()) q.set('kind', params.kind.trim());
  if (params.from?.trim()) q.set('from', params.from.trim());
  if (params.to?.trim()) q.set('to', params.to.trim());
  if (params.page != null && params.page > 0) q.set('page', String(params.page));
  if (params.pageSize != null && params.pageSize > 0) q.set('pageSize', String(params.pageSize));
  const out = await request<CrmJobListResponse>(`crm/jobs?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

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
  }>(path);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /crm/dispatch-rules — 發券規則列表 */
export interface DispatchRuleRow {
  id: string;
  merchantId: string;
  name: string;
  segmentId: string;
  couponId: string;
  enabled: boolean;
  scheduleType: string;
  cronExpr: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export async function listDispatchRules(
  merchantId: string,
  enabled?: boolean,
): Promise<DispatchRuleRow[] | ApiError> {
  const q = new URLSearchParams({ merchantId });
  if (enabled === true) q.set('enabled', 'true');
  if (enabled === false) q.set('enabled', 'false');
  const path = q.toString();
  const out = await request<DispatchRuleRow[]>(`crm/dispatch-rules?${path}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /crm/dispatch-rules — 新增發券規則 */
export async function createDispatchRule(
  merchantId: string,
  body: {
    name: string;
    segmentId: string;
    couponId: string;
    enabled?: boolean;
    scheduleType: string;
    cronExpr?: string;
    nextRunAt?: string;
  },
): Promise<DispatchRuleRow | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await request<DispatchRuleRow>(`crm/dispatch-rules?${q}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** PATCH /crm/dispatch-rules/:id — 更新發券規則 */
export async function updateDispatchRule(
  merchantId: string,
  id: string,
  body: Partial<{
    name: string;
    segmentId: string;
    couponId: string;
    enabled: boolean;
    scheduleType: string;
    cronExpr: string | null;
    nextRunAt: string | null;
  }>,
): Promise<DispatchRuleRow | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await request<DispatchRuleRow>(`crm/dispatch-rules/${encodeURIComponent(id)}?${q}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** DELETE /crm/dispatch-rules/:id */
export async function deleteDispatchRule(
  merchantId: string,
  id: string,
): Promise<{ ok: boolean } | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await request<{ ok: boolean }>(`crm/dispatch-rules/${encodeURIComponent(id)}?${q}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /loyalty/reports/activity — 活動／用券／點數報表（含擴充：byDispatchRule、byCoupon、revenueFromPointRedemption） */
export interface LoyaltyReportActivity {
  from: string;
  to: string;
  participations: number;
  couponUsage: number;
  pointsCostEstimate: number;
  couponUsageByCoupon?: { couponId: string; count: number }[];
  byDispatchRule?: Array<{
    ruleId: string;
    ruleName: string;
    segmentId: string;
    couponId: string;
    jobRunsCount: number;
    sentCount: number | null;
  }>;
  byCoupon?: Array<{
    couponId: string;
    couponCode: string;
    name: string;
    sentCount: number;
    usedCount: number;
  }>;
  revenueFromPointRedemption?: number;
}
export async function getLoyaltyReportActivity(
  merchantId: string,
  params: { from?: string; to?: string; preset?: string; groupBy?: string },
): Promise<LoyaltyReportActivity | ApiError> {
  const q = new URLSearchParams({ merchantId });
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.preset) q.set('preset', params.preset);
  if (params.groupBy) q.set('groupBy', params.groupBy);
  const out = await request<LoyaltyReportActivity>(`loyalty/reports/activity?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /loyalty/reports/members — 會員報表（newMembersCount 等） */
export interface LoyaltyReportMembers {
  from: string;
  to: string;
  newMembersCount: number;
  pointsEarned?: number;
  pointsBurned?: number;
  couponIssuedCount?: number;
  membersWithPointsCount?: number;
  byMemberLevel?: { memberLevel: string; count: number }[];
}
export async function getLoyaltyReportMembers(
  merchantId: string,
  params?: { from?: string; to?: string; preset?: string },
): Promise<LoyaltyReportMembers | ApiError> {
  const q = new URLSearchParams({ merchantId });
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.preset) q.set('preset', params.preset);
  const out = await request<LoyaltyReportMembers>(`loyalty/reports/members?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

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
  const url = `${BASE_URL.replace(/\/$/, '')}/${path}`;
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

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  traceId?: string;
}

async function request<T>(
  path: string,
  options: RequestInit & { traceId?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const { traceId = genTraceId(), ...init } = options;
  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  (headers as Record<string, string>)['X-Trace-Id'] = traceId;
  if (ADMIN_API_KEY && needsAdminKey(path, init.method ?? 'GET')) {
    (headers as Record<string, string>)['X-Admin-Key'] = ADMIN_API_KEY;
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch';
    return {
      ok: false,
      error: {
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: msg,
        traceId,
      },
    };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      ok: false,
      error: {
        statusCode: res.status,
        message: (err.message as string) ?? res.statusText,
        code: err.code as string | undefined,
        traceId: (err.traceId as string) ?? traceId,
      },
    };
  }
  return { ok: true, data: body as T };
}

export interface DashboardSummaryDto {
  productCount: number;
  skuOutOfStockCount: number;
  skuLowStockCount: number;
  ordersTodayCount: number;
  totalOnHandUnits: number;
  inventoryValueApprox: string;
  lowStockThreshold: number;
}

export async function getDashboardSummary(): Promise<
  DashboardSummaryDto | ApiError
> {
  const out = await request<DashboardSummaryDto>('admin/dashboard/summary');
  if (!out.ok) return out.error;
  return out.data;
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  merchantId: string;
  storeId?: string | null;
}

export async function getWarehouses(): Promise<WarehouseDto[] | ApiError> {
  const out = await request<WarehouseDto[]>('warehouses');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createWarehouse(body: {
  code: string;
  name: string;
  merchantId: string;
  storeId?: string | null;
}): Promise<WarehouseDto | ApiError> {
  const out = await request<WarehouseDto>('warehouses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateWarehouse(
  id: string,
  body: { code?: string; name?: string; storeId?: string | null },
): Promise<WarehouseDto | ApiError> {
  const out = await request<WarehouseDto>(`warehouses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteWarehouse(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`warehouses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

export interface BalanceEnrichedRow {
  productId: string;
  warehouseId: string;
  onHandQty: number;
  updatedAt: string;
  sku: string | null;
  name: string | null;
}

export async function getBalancesEnriched(
  warehouseId: string,
): Promise<BalanceEnrichedRow[] | ApiError> {
  const out = await request<BalanceEnrichedRow[]>(
    `inventory/balances/enriched?warehouseId=${encodeURIComponent(warehouseId)}`,
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface InventoryEventRow {
  id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  occurredAt: string;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface PagedEvents {
  items: InventoryEventRow[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getInventoryEvents(params: {
  warehouseId: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedEvents | ApiError> {
  const q = new URLSearchParams();
  q.set('warehouseId', params.warehouseId);
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<PagedEvents>(`inventory/events?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

export interface InventoryBalanceRow {
  id: string;
  productId: string;
  warehouseId: string;
  onHandQty: number;
  updatedAt: string;
}

export async function getInventoryBalances(params?: {
  productId?: string;
  warehouseId?: string;
}): Promise<InventoryBalanceRow[] | ApiError> {
  const q = new URLSearchParams();
  if (params?.productId) q.set('productId', params.productId);
  if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
  const qs = q.toString();
  const out = await request<InventoryBalanceRow[]>(
    qs ? `inventory/balances?${qs}` : 'inventory/balances',
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface SlowMovingItem {
  productId: string;
  sku: string | null;
  name: string | null;
  soldQty: number;
  onHandQty: number;
  warehouseId: string | null;
}

export interface SlowMovingResult {
  items: SlowMovingItem[];
  from: string;
  to: string;
}

/** GET /inventory/slow-moving — 滯銷品（依 merchantId） */
export async function getSlowMoving(params: {
  merchantId: string;
  warehouseId?: string;
  lookbackDays?: number;
  salesThreshold?: number;
  onHandThreshold?: number;
}): Promise<SlowMovingResult | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.lookbackDays != null) q.set('lookbackDays', String(params.lookbackDays));
  if (params.salesThreshold != null) q.set('salesThreshold', String(params.salesThreshold));
  if (params.onHandThreshold != null) q.set('onHandThreshold', String(params.onHandThreshold));
  const out = await request<SlowMovingResult>(`inventory/slow-moving?${q.toString()}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /inventory/events/batch-stocktake — 多品多倉盤點（Admin Key） */
export async function batchStocktake(body: {
  warehouseId: string;
  lines: { productId: string; actualQty: number }[];
}): Promise<{ ok: number; failed: { productId: string; reason: string }[] } | ApiError> {
  const out = await request<{ ok: number; failed: { productId: string; reason: string }[] }>(
    'inventory/events/batch-stocktake',
    {
      method: 'POST',
      body: JSON.stringify({
        warehouseId: body.warehouseId,
        lines: body.lines,
      }),
    },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export interface ExpiringBatchRow {
  productId: string;
  warehouseId: string;
  batchCode: string | null;
  expiryDate: string;
  onHandQty: number;
  sku: string | null;
  productName: string | null;
}

export interface ExpiringInventoryResult {
  items: ExpiringBatchRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ExpiringProductSummaryRow {
  productId: string;
  sku: string | null;
  productName: string | null;
  earliestExpiryDate: string;
  expiringQty: number;
  warehousesCount: number;
}

/** GET /inventory/expiring — 即將到期批次列表（依商品／倉庫過濾） */
export async function getExpiringInventory(params: {
  warehouseId?: string;
  productId?: string;
  from?: string;
  to?: string;
  daysAhead?: number;
  page?: number;
  pageSize?: number;
}): Promise<ExpiringInventoryResult | ApiError> {
  const q = new URLSearchParams();
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.productId) q.set('productId', params.productId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = q.toString() ? `inventory/expiring?${q}` : 'inventory/expiring';
  const out = await request<ExpiringInventoryResult>(path);
  if (!out.ok) return out.error;
  const data = out.data as unknown as ExpiringInventoryResult;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: typeof data.page === 'number' ? data.page : 1,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : data.items.length,
    total: typeof data.total === 'number' ? data.total : data.items.length,
  };
}

/** GET /inventory/expiring?groupBy=product — 依商品彙總即期庫存 */
export async function getExpiringInventorySummaryByProduct(params: {
  warehouseId?: string;
  from?: string;
  to?: string;
  daysAhead?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ExpiringProductSummaryRow[]; page: number; pageSize: number; total: number } | ApiError> {
  const q = new URLSearchParams();
  q.set('groupBy', 'product');
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<{ items: ExpiringProductSummaryRow[]; page: number; pageSize: number; total: number }>(
    `inventory/expiring?${q.toString()}`,
  );
  if (!out.ok) return out.error;
  const d = out.data as unknown as { items?: unknown; page?: unknown; pageSize?: unknown; total?: unknown };
  return {
    items: Array.isArray(d.items) ? (d.items as ExpiringProductSummaryRow[]) : [],
    page: typeof d.page === 'number' ? (d.page as number) : 1,
    pageSize: typeof d.pageSize === 'number' ? (d.pageSize as number) : 50,
    total: typeof d.total === 'number' ? (d.total as number) : (Array.isArray(d.items) ? d.items.length : 0),
  };
}

export interface ProductFullDto {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
  /** @deprecated use specStyle */
  specColor?: string | null;
  /** @deprecated use specWeight */
  weightGrams?: number | null;
  listPrice?: string;
  salePrice?: string;
  costPrice?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getProducts(): Promise<ProductFullDto[] | ApiError> {
  const out = await request<ProductFullDto[]>('products');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /products/search-barcode?q= — 條碼精確查詢（回 { items }） */
export async function searchProductsByBarcode(
  q: string,
  limit = 20,
): Promise<{ items: ProductFullDto[] } | ApiError> {
  const term = q.trim();
  if (!term) return { items: [] };
  const qs = new URLSearchParams({ q: term, limit: String(limit) });
  const out = await request<{ items: ProductFullDto[] }>(`products/search-barcode?${qs}`);
  if (!out.ok) return out.error;
  return { items: Array.isArray(out.data.items) ? out.data.items : [] };
}

export async function createProduct(body: {
  sku: string;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}): Promise<ProductFullDto | ApiError> {
  const out = await request<ProductFullDto>('products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** PATCH /products/batch-price — 批次改價（Admin Key；後端未上線時可能 404/501） */
export async function batchUpdateProductPrice(body: {
  productIds: string[];
  salePrice: string | number;
}): Promise<{ updated: number } | ApiError> {
  const out = await request<{ updated: number }>('products/batch-price', {
    method: 'PATCH',
    body: JSON.stringify({
      productIds: body.productIds,
      salePrice: String(body.salePrice),
    }),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateProduct(
  id: string,
  body: {
    sku?: string;
    name?: string;
    description?: string | null;
    specSize?: string | null;
    specCapacity?: string | null;
    specStyle?: string | null;
    specWeight?: string | null;
    expiryDescription?: string | null;
    listPrice?: string | number | null;
    salePrice?: string | number | null;
    costPrice?: string | number | null;
    categoryId?: string | null;
    brandId?: string | null;
    tags?: string[];
  },
): Promise<ProductFullDto | ApiError> {
  const out = await request<ProductFullDto>(`products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteProduct(id: string): Promise<{ success: boolean } | ApiError> {
  const out = await request<{ success: boolean }>(`products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /product-tags；回傳 ProductTagDto[] */
export interface ProductTagDto {
  id: string;
  name: string;
  code?: string | null;
}
export async function listProductTags(merchantId: string): Promise<ProductTagDto[] | ApiError> {
  const out = await request<ProductTagDto[]>(`product-tags?merchantId=${encodeURIComponent(merchantId)}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
/** 取得標籤名稱列表（供商品頁下拉用） */
export async function getProductTags(merchantId: string): Promise<string[] | ApiError> {
  const arr = await listProductTags(merchantId);
  if (!Array.isArray(arr)) return arr;
  return arr.map((t) => t.name ?? t.code ?? '').filter(Boolean);
}
export async function createProductTag(
  merchantId: string,
  body: { name: string; code: string },
): Promise<ProductTagDto | ApiError> {
  const out = await request<ProductTagDto>('product-tags', {
    method: 'POST',
    body: JSON.stringify({ merchantId, ...body }),
  });
  if (!out.ok) return out.error;
  return out.data;
}
export async function updateProductTag(
  id: string,
  body: { name?: string; code?: string },
): Promise<ProductTagDto | ApiError> {
  const out = await request<ProductTagDto>(`product-tags/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}
export async function deleteProductTag(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`product-tags/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
}

export type ProductImportResult = {
  ok: number;
  failed: { row: number; reason: string }[];
};

/** POST /products/import multipart field **file**（CSV）；需 X-Admin-Key */
export async function importProductsCsv(
  file: File,
): Promise<ProductImportResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/products/import`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', headers, body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      statusCode: res.status,
      message: (err.message as string) ?? res.statusText,
      code: err.code as string | undefined,
      traceId: (err.traceId as string) ?? traceId,
    };
  }
  const data = body as ProductImportResult;
  if (typeof data?.ok !== 'number' || !Array.isArray(data?.failed)) {
    return {
      statusCode: 500,
      message: 'invalid import response',
      traceId,
    };
  }
  return data;
}

/** POST /customers/import/preview?merchantId= */
export type CustomerImportPreviewRow = {
  row: number;
  name: string;
  phone: string | null;
  memberLevel: string | null;
  code: string | null;
  conflict: boolean;
  reasons: string[];
  existing: { id: string; name?: string; phone?: string | null } | null;
};
export type CustomerImportPreviewResult = {
  fileHash: string;
  rows: CustomerImportPreviewRow[];
  parseErrors: { row: number; reason: string }[];
};

export async function previewCustomersImport(
  file: File,
  merchantId: string,
): Promise<CustomerImportPreviewResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/customers/import/preview?merchantId=${encodeURIComponent(merchantId)}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', headers, body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      statusCode: res.status,
      message: (err.message as string) ?? res.statusText,
      code: err.code as string | undefined,
      traceId: (err.traceId as string) ?? traceId,
    };
  }
  const data = body as CustomerImportPreviewResult;
  if (typeof data?.fileHash !== 'string' || !Array.isArray(data?.rows)) {
    return { statusCode: 500, message: 'invalid preview response', traceId };
  }
  return data;
}

export type CustomerImportApplyDecision = {
  row: number;
  action: 'skip' | 'create' | 'overwrite';
  customerId?: string;
};
export type CustomerImportApplyResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: { row: number; reason: string }[];
};

/** POST /customers/import/apply?merchantId= multipart: file + fileHash + decisions (JSON) */
export async function applyCustomersImport(
  file: File,
  merchantId: string,
  fileHash: string,
  decisions: CustomerImportApplyDecision[],
): Promise<CustomerImportApplyResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/customers/import/apply?merchantId=${encodeURIComponent(merchantId)}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const form = new FormData();
  form.append('file', file);
  form.append('fileHash', fileHash);
  form.append('decisions', JSON.stringify(decisions));
  const res = await fetch(url, { method: 'POST', headers, body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      statusCode: res.status,
      message: (err.message as string) ?? res.statusText,
      code: err.code as string | undefined,
      traceId: (err.traceId as string) ?? traceId,
    };
  }
  const data = body as CustomerImportApplyResult;
  if (
    typeof data?.created !== 'number' ||
    typeof data?.updated !== 'number' ||
    typeof data?.skipped !== 'number' ||
    !Array.isArray(data?.failed)
  ) {
    return { statusCode: 500, message: 'invalid apply response', traceId };
  }
  return data;
}

/** §7 POST /customers — 新增會員（Admin Key） */
export type CreateCustomerBody = {
  merchantId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  memberLevel?: string | null;
  code?: string | null;
  memberCode?: string | null;
};
export type CustomerDetailDto = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  memberLevel?: string | null;
  code?: string | null;
  memberCode?: string | null;
  joinDate?: string | null;
  pointBalance?: number | null;
  expiringSoon?: number | null;
  expiringAt?: string | null;
  status?: string | null;
  blockReason?: string | null;
  tags?: string[] | null;
};
export async function createCustomer(
  body: CreateCustomerBody,
): Promise<CustomerDetailDto | ApiError> {
  const out = await request<CustomerDetailDto>('customers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** §7 GET /customers/:id — 單筆詳情 */
export async function getCustomer(id: string): Promise<CustomerDetailDto | ApiError> {
  const out = await request<CustomerDetailDto>(`customers/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** §7 PATCH /customers/:id — 更新會員（Admin Key）；可更新 status、blockReason、tags */
export async function patchCustomer(
  id: string,
  body: Partial<Pick<CustomerDetailDto, 'name' | 'phone' | 'email' | 'memberLevel' | 'code' | 'memberCode' | 'joinDate' | 'status' | 'blockReason' | 'tags'>>,
): Promise<CustomerDetailDto | ApiError> {
  const out = await request<CustomerDetailDto>(`customers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /customers/merge — 合併會員（Admin Key）；body { primaryId, mergeIds } */
export async function mergeCustomers(
  primaryId: string,
  mergeIds: string[],
): Promise<{ primaryId: string; merged: string[] } | ApiError> {
  const out = await request<{ primaryId: string; merged: string[] }>('customers/merge', {
    method: 'POST',
    body: JSON.stringify({ primaryId: primaryId.trim(), mergeIds }),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export type CustomerContactItem = {
  id: string;
  type: string;
  note: string | null;
  nextFollowUpAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** GET /customers/:id/contacts — 互動紀錄列表 */
export async function getCustomerContacts(
  customerId: string,
  merchantId?: string,
): Promise<{ items: CustomerContactItem[] } | ApiError> {
  const q = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : '';
  const out = await request<{ items: CustomerContactItem[] }>(
    `customers/${encodeURIComponent(customerId)}/contacts${q}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /customers/:id/contacts — 新增互動紀錄（Admin Key） */
export async function addCustomerContact(
  customerId: string,
  body: { type: string; note?: string; nextFollowUpAt?: string; createdBy?: string },
  merchantId?: string,
): Promise<CustomerContactItem | ApiError> {
  const q = merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : '';
  const out = await request<CustomerContactItem>(
    `customers/${encodeURIComponent(customerId)}/contacts${q}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export type ImportJobKind = 'products_csv' | 'inventory_csv';
export type ImportJobDto = {
  id: string;
  kind: string;
  status: string;
  result: { ok?: number; failed?: { row: number; reason: string }[] } | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

/** POST /imports/jobs/:kind multipart file */
export async function createImportJob(
  kind: ImportJobKind,
  file: File,
): Promise<{ jobId: string } | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/imports/jobs/${kind}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', headers, body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      statusCode: res.status,
      message: (err.message as string) ?? res.statusText,
      code: err.code as string | undefined,
      traceId: (err.traceId as string) ?? traceId,
    };
  }
  const data = body as { jobId?: string };
  if (!data?.jobId) return { statusCode: 500, message: 'invalid job response', traceId };
  return { jobId: data.jobId };
}

export async function getImportJob(id: string): Promise<ImportJobDto | ApiError> {
  const out = await request<ImportJobDto>(`imports/jobs/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  if (!out.ok) return out.error;
  return out.data;
}

export type InventoryImportResult = { ok: number; failed: { row: number; reason: string }[] };

/** POST /inventory/events/import multipart **file**（CSV）；需 X-Admin-Key */
export async function importInventoryEventsCsv(
  file: File,
): Promise<InventoryImportResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/inventory/events/import`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', headers, body: form });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      statusCode: res.status,
      message: (err.message as string) ?? res.statusText,
      code: err.code as string | undefined,
      traceId: (err.traceId as string) ?? traceId,
    };
  }
  const data = body as InventoryImportResult;
  if (typeof data?.ok !== 'number' || !Array.isArray(data?.failed)) {
    return { statusCode: 500, message: 'invalid import response', traceId };
  }
  return data;
}

export type InventoryEventType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_FROM_CUSTOMER'
  | 'RETURN_TO_SUPPLIER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS';

export async function postInventoryEvent(body: {
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt?: string;
  note?: string;
  referenceId?: string;
}): Promise<{ event: InventoryEventRow; balance: { onHandQty: number } } | ApiError> {
  const out = await request<{ event: InventoryEventRow; balance: { onHandQty: number } }>(
    'inventory/events',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export async function postInventoryTransfer(body: {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string;
  occurredAt?: string;
}): Promise<
  | {
      referenceId: string;
      balances: { from: { warehouseId: string; onHandQty: number }; to: { warehouseId: string; onHandQty: number } };
    }
  | ApiError
> {
  const out = await request<{
    referenceId: string;
    balances: { from: { warehouseId: string; onHandQty: number }; to: { warehouseId: string; onHandQty: number } };
  }>('inventory/transfer', { method: 'POST', body: JSON.stringify(body) });
  if (!out.ok) return out.error;
  return out.data;
}

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
}
export interface BrandDto {
  id: string;
  code: string;
  name: string;
}

export async function getCategories(): Promise<CategoryDto[] | ApiError> {
  const out = await request<CategoryDto[]>('categories');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /categories/enriched — 含商品數等（唯讀） */
export async function getCategoriesEnriched(): Promise<
  (CategoryDto & { productCount?: number })[] | ApiError
> {
  const out = await request<(CategoryDto & { productCount?: number })[]>('categories/enriched');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
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

/** GET /finance/summary — 依 type 或 partyId 彙總區間內金額；groupBy=type 回傳 byType；groupBy=partyId 回傳 byParty */
export type FinanceSummaryByType = { byType: Record<string, number> };
export type FinanceSummaryByPartyId = {
  byParty: Array<{ partyId: string; amountsByType: Record<string, number> }>;
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
  partyId?: string;
  kind?: 'customer' | 'supplier';
}): Promise<{ items: FinanceBalanceItem[] } | ApiError> {
  const q = new URLSearchParams();
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
  groupBy: 'type' | 'partyId';
}): Promise<FinanceSummaryByType | FinanceSummaryByPartyId | ApiError> {
  const q = new URLSearchParams();
  if (params.preset) q.set('preset', params.preset);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  q.set('groupBy', params.groupBy);
  const out = await request<FinanceSummaryByType | FinanceSummaryByPartyId>(
    `finance/summary?${q.toString()}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /purchase-orders/from-replenishment — 依補貨建議建立 DRAFT 採購單；API 未就緒時回 404 */
export async function createPurchaseOrderFromReplenishment(body: {
  supplierId: string;
  warehouseId: string;
  suggestions: Array<{ productId: string; suggestedQty: number }>;
}): Promise<{ id: string; orderNumber: string } | ApiError> {
  const out = await request<{ id: string; orderNumber: string }>(
    'purchase-orders/from-replenishment',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export interface ReplenishmentSuggestionRow {
  productId: string;
  warehouseId: string;
  onHandQty: number;
  avgDailySales: number;
  targetStock: number;
  suggestedQty: number;
  reason: string;
  sku: string | null;
  productName: string | null;
}

export interface ReplenishmentSuggestionResult {
  config: { daysLookback: number; daysAhead: number; safetyDays: number };
  items: ReplenishmentSuggestionRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** GET /inventory/replenishment-suggestions — 補貨建議列表 */
export async function getReplenishmentSuggestions(params: {
  merchantId: string;
  warehouseId?: string;
  daysLookback?: number;
  daysAhead?: number;
  safetyDays?: number;
  minSuggestedQty?: number;
  page?: number;
  pageSize?: number;
}): Promise<ReplenishmentSuggestionResult | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.daysLookback != null) q.set('daysLookback', String(params.daysLookback));
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.safetyDays != null) q.set('safetyDays', String(params.safetyDays));
  if (params.minSuggestedQty != null) q.set('minSuggestedQty', String(params.minSuggestedQty));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<ReplenishmentSuggestionResult>(`inventory/replenishment-suggestions?${q}`);
  if (!out.ok) return out.error;
  const data = out.data as unknown as ReplenishmentSuggestionResult;
  return {
    config: data.config,
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page ?? 1,
    pageSize: data.pageSize ?? (Array.isArray(data.items) ? data.items.length : 0),
    total: data.total ?? (Array.isArray(data.items) ? data.items.length : 0),
  };
}

export async function createCategory(body: {
  code: string;
  name: string;
}): Promise<CategoryDto | ApiError> {
  const out = await request<CategoryDto>('categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateCategory(
  id: string,
  body: { code?: string; name?: string },
): Promise<CategoryDto | ApiError> {
  const out = await request<CategoryDto>(`categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** 後端若已上 DELETE /categories/:id 再使用；否則 404 */
export async function deleteCategory(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
}

export async function getBrands(): Promise<BrandDto[] | ApiError> {
  const out = await request<BrandDto[]>('brands');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createBrand(body: { code: string; name: string }): Promise<BrandDto | ApiError> {
  const out = await request<BrandDto>('brands', { method: 'POST', body: JSON.stringify(body) });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateBrand(
  id: string,
  body: { code?: string; name?: string },
): Promise<BrandDto | ApiError> {
  const out = await request<BrandDto>(`brands/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteBrand(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

/** Merchant／Store — MerchantController */
export interface MerchantDto {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreDto {
  id: string;
  code: string;
  name: string;
  merchantId: string;
  createdAt?: string;
  updatedAt?: string;
}

/** §9 GET /merchant/current — 單一商家，回傳 { id, code, name }；失敗 404/400。 */
export type MerchantCurrentDto = { id: string; code?: string; name?: string };

export async function getMerchantCurrent(): Promise<MerchantCurrentDto | ApiError> {
  const out = await request<MerchantCurrentDto>('merchant/current');
  if (!out.ok) return out.error;
  return out.data;
}

export async function listMerchants(): Promise<MerchantDto[] | ApiError> {
  const out = await request<MerchantDto[]>('merchants');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createMerchant(body: {
  code: string;
  name: string;
}): Promise<MerchantDto | ApiError> {
  const out = await request<MerchantDto>('merchants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateMerchant(
  id: string,
  body: { code?: string; name?: string },
): Promise<MerchantDto | ApiError> {
  const out = await request<MerchantDto>(`merchants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteMerchant(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`merchants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

export async function listStores(): Promise<StoreDto[] | ApiError> {
  const out = await request<StoreDto[]>('stores');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createStore(body: {
  code: string;
  name: string;
  merchantId: string;
}): Promise<StoreDto | ApiError> {
  const out = await request<StoreDto>('stores', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateStore(
  id: string,
  body: { code?: string; name?: string },
): Promise<StoreDto | ApiError> {
  const out = await request<StoreDto>(`stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteStore(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`stores/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

export interface PromotionRuleDto {
  id: string;
  merchantId: string;
  name: string;
  priority: number;
  draft: boolean;
  startsAt: string | null;
  endsAt: string | null;
  exclusive: boolean;
  firstPurchaseOnly: boolean;
  memberLevels: string[];
  conditions: unknown[];
  actions: unknown[];
  status: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionEffectivenessItem {
  ruleId: string;
  ruleName: string;
  triggerCount: number;
  discountTotal: number;
  drivenRevenue: number;
}

export interface PromotionEffectivenessResponse {
  items: PromotionEffectivenessItem[];
}

export async function getPromotionEffectiveness(params: {
  merchantId: string;
  preset?: 'last30d';
  from?: string;
  to?: string;
}): Promise<PromotionEffectivenessResponse | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.preset) q.set('preset', params.preset);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const path = `promotion-rules/effectiveness?${q.toString()}`;
  const out = await request<PromotionEffectivenessResponse>(path);
  if (!out.ok) return out.error;
  return out.data;
}

export async function listPromotionRules(params: {
  merchantId: string;
  status?: string;
  q?: string;
}): Promise<PromotionRuleDto[] | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.status) q.set('status', params.status);
  if (params.q) q.set('q', params.q);
  const out = await request<PromotionRuleDto[]>(`promotion-rules?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getPromotionRule(id: string): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function createPromotionRule(body: {
  merchantId: string;
  name: string;
  priority?: number;
  draft?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  exclusive?: boolean;
  firstPurchaseOnly?: boolean;
  memberLevels?: string[];
  conditions?: unknown[];
  actions?: unknown[];
}): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>('promotion-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data as PromotionRuleDto;
}

export async function updatePromotionRule(
  id: string,
  body: {
    merchantId: string;
    name?: string;
    priority?: number;
    draft?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    exclusive?: boolean;
    firstPurchaseOnly?: boolean;
    memberLevels?: string[];
    conditions?: unknown[];
    actions?: unknown[];
  },
): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data as PromotionRuleDto;
}

export async function deletePromotionRule(
  id: string,
  merchantId: string,
): Promise<void | ApiError> {
  const out = await request<unknown>(
    `promotion-rules/${encodeURIComponent(id)}?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'DELETE' },
  );
  if (!out.ok) return out.error;
}

export async function reorderPromotionRules(
  merchantId: string,
  ids: string[],
): Promise<void | ApiError> {
  const out = await request<unknown>('promotion-rules/reorder/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ merchantId, ids }),
  });
  if (!out.ok) return out.error;
}
