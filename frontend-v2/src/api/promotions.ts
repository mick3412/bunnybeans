import { api, type ApiError } from './client';

export type PromotionRuleDto = {
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
};

export async function listPromotionRules(params: {
  merchantId: string;
  status?: string;
  q?: string;
}): Promise<PromotionRuleDto[] | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.status?.trim()) q.set('status', params.status.trim());
  if (params.q?.trim()) q.set('q', params.q.trim());
  const out = await api<PromotionRuleDto[]>(`promotion-rules?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getPromotionRule(id: string): Promise<PromotionRuleDto | ApiError> {
  const out = await api<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function updatePromotionRule(
  id: string,
  merchantId: string,
  body: Partial<Pick<PromotionRuleDto, 'name' | 'draft' | 'startsAt' | 'endsAt' | 'priority'>>,
): Promise<PromotionRuleDto | ApiError> {
  const out = await api<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ merchantId, ...body }),
    needAdminKey: true,
  });
  if (!out.ok) return out.error;
  return out.data;
}
