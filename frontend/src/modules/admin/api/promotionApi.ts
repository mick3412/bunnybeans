/**
 * promotionApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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
