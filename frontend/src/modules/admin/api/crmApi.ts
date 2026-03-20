/**
 * crmApi — 自 adminApi 拆分
 */
import { request, type ApiError, fetchCsvExport } from './client';

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
  lastRunAt?: string | null;
  lastRunCode?: string | null;
  lastRunNote?: string | null;
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
