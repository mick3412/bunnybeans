/**
 * Loyalty CRM API — docs/api-design-loyalty.md
 */
import type { ApiError } from './adminApi';

const BASE_URL =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3003' : '');
const ADMIN_API_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

async function req<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceId,
  };
  const m = (init.method ?? 'GET').toUpperCase();
  if (
    ADMIN_API_KEY &&
    (m === 'PATCH' || m === 'POST') &&
    (path.includes('loyalty/settings') || path.includes('loyalty/coupons'))
  ) {
    headers['X-Admin-Key'] = ADMIN_API_KEY;
  }
  const res = await fetch(url, { ...init, headers });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  const b = body as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      error: {
        statusCode: res.status,
        message: (b.message as string) ?? res.statusText,
        code: b.code as string | undefined,
        traceId: (b.traceId as string) ?? traceId,
      },
    };
  }
  if (b?.error && typeof b.error === 'object') {
    const e = b.error as { message?: string; code?: string };
    return {
      ok: false,
      error: {
        statusCode: 400,
        message: e.message ?? 'Request failed',
        code: e.code,
        traceId,
      },
    };
  }
  return { ok: true, data: body as T };
}

export type LoyaltySettingsDto = {
  merchantId: string;
  earnPerNT: number;
  pointValueNT: number;
  birthdayMultiplier: number;
  rollingDays: number;
  notifyDaysBefore: number;
};

export async function getLoyaltySettings(
  merchantId: string,
): Promise<LoyaltySettingsDto | ApiError> {
  const out = await req<LoyaltySettingsDto>(
    `loyalty/settings?merchantId=${encodeURIComponent(merchantId)}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

export async function patchLoyaltySettings(
  merchantId: string,
  body: Partial<
    Pick<
      LoyaltySettingsDto,
      'earnPerNT' | 'pointValueNT' | 'birthdayMultiplier' | 'rollingDays' | 'notifyDaysBefore'
    >
  >,
): Promise<LoyaltySettingsDto | ApiError> {
  const out = await req<LoyaltySettingsDto>(
    `loyalty/settings?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export type LedgerItemDto = {
  id: string;
  customerId?: string;
  customerName?: string | null;
  type: string;
  amount: number;
  balanceAfter: number;
  txnCode: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
};

export async function getPointLedger(
  merchantId: string,
  customerId: string | undefined,
  limit = 100,
): Promise<{ items: LedgerItemDto[] } | ApiError> {
  const q = new URLSearchParams({ merchantId, limit: String(limit) });
  if (customerId?.trim()) q.set('customerId', customerId.trim());
  const out = await req<{ items: LedgerItemDto[] }>(`loyalty/point-ledger?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

export type LoyaltyDashboardDto = {
  pointsIssued30d: number;
  pointsRedeemed30d: number;
  activeMembersWithPoints: number;
  circulatingPointsTotal?: number;
  newMembersThisMonth?: number;
  totalPointsBurnedLifetime?: number;
  ongoingPromotionsCount?: number;
  recentLedger?: {
    id: string;
    customerId: string;
    customerName: string;
    type: string;
    amount: number;
    balanceAfter: number;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
  }[];
  activePromotions?: {
    id: string;
    name: string;
    usageCount: number;
    startsAt: string | null;
    endsAt: string | null;
  }[];
};

export async function getLoyaltyDashboard(
  merchantId: string,
): Promise<LoyaltyDashboardDto | ApiError> {
  const out = await req<LoyaltyDashboardDto>(
    `loyalty/dashboard?merchantId=${encodeURIComponent(merchantId)}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

export type LoyaltyCustomerRow = {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  memberLevel?: string | null;
  memberCode?: string | null;
  joinDate?: string | null;
  pointBalance?: number | null;
  expiringSoon?: number | null;
  expiringAt?: string | null;
  status?: string | null;
  tags?: string[] | null;
};

export async function listLoyaltyCustomers(
  merchantId: string,
  opts?: { status?: string; tag?: string },
): Promise<LoyaltyCustomerRow[] | ApiError> {
  const q = new URLSearchParams({ merchantId });
  if (opts?.status?.trim()) q.set('status', opts.status.trim());
  if (opts?.tag?.trim()) q.set('tag', opts.tag.trim());
  const out = await req<LoyaltyCustomerRow[]>(`customers?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** §8 GET /customers/search?merchantId=&q= — 模糊搜尋 phone／name／memberCode，最多 20 筆；q 空白回傳空陣列 */
export type CustomerSearchItem = {
  id: string;
  name: string;
  phone: string | null;
  memberLevel: string | null;
  memberCode: string | null;
};

export async function searchCustomers(
  merchantId: string,
  q: string,
): Promise<{ items: CustomerSearchItem[] } | ApiError> {
  const params = new URLSearchParams({ merchantId, q: q.trim() });
  const out = await req<{ items: CustomerSearchItem[] }>(
    `customers/search?${params}`,
  );
  if (!out.ok) return out.error;
  const data = out.data as { items?: CustomerSearchItem[] };
  return { items: Array.isArray(data?.items) ? data.items : [] };
}

export type LoyaltyCouponDto = {
  id: string;
  code: string;
  name: string;
  discountType: string;
  value: number;
  validFrom: string | null;
  validTo: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
};

export async function listLoyaltyCoupons(
  merchantId: string,
): Promise<{ items: LoyaltyCouponDto[] } | ApiError> {
  const out = await req<{ items: LoyaltyCouponDto[] }>(
    `loyalty/coupons?merchantId=${encodeURIComponent(merchantId)}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

export async function createLoyaltyCoupon(
  merchantId: string,
  body: {
    code: string;
    name: string;
    discountType: string;
    value: number;
    validFrom?: string;
    validTo?: string;
    maxUses?: number;
    active?: boolean;
  },
): Promise<{ id: string } | ApiError> {
  const out = await req<{ id: string }>(
    `loyalty/coupons?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export async function patchLoyaltyCoupon(
  merchantId: string,
  id: string,
  body: Partial<{
    name: string;
    value: number;
    validFrom: string | null;
    validTo: string | null;
    maxUses: number | null;
    active: boolean;
  }>,
): Promise<unknown | ApiError> {
  const out = await req<unknown>(
    `loyalty/coupons/${encodeURIComponent(id)}?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export type TierRuleDto = {
  id: string;
  merchantId: string;
  name: string;
  ruleType: string;
  threshold: number;
  targetLevel: string;
  lookbackDays: number;
  createdAt: string;
};

/** GET /crm/tier-rules?merchantId= — 會員等級規則列表 */
export async function listTierRules(
  merchantId: string,
): Promise<TierRuleDto[] | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await req<TierRuleDto[]>(`crm/tier-rules?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** POST /crm/tier-rules?merchantId= — 新增會員等級規則 */
export async function createTierRule(
  merchantId: string,
  body: { name: string; ruleType: string; threshold: number; targetLevel: string; lookbackDays?: number },
): Promise<TierRuleDto | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await req<TierRuleDto>(`crm/tier-rules?${q}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** PATCH /crm/tier-rules/:id?merchantId= — 更新會員等級規則 */
export async function updateTierRule(
  merchantId: string,
  id: string,
  body: Partial<{ name: string; threshold: number; targetLevel: string; lookbackDays: number }>,
): Promise<TierRuleDto | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await req<TierRuleDto>(`crm/tier-rules/${encodeURIComponent(id)}?${q}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** DELETE /crm/tier-rules/:id?merchantId= — 刪除會員等級規則 */
export async function deleteTierRule(
  merchantId: string,
  id: string,
): Promise<void | ApiError> {
  const q = new URLSearchParams({ merchantId });
  const out = await req<unknown>(`crm/tier-rules/${encodeURIComponent(id)}?${q}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
}

/** POST /crm/recalc-tiers — 依 TierRule 批次重算會員等級 */
export async function recalcTiers(
  merchantId: string,
): Promise<{ updated: number } | ApiError> {
  const out = await req<{ updated: number }>('crm/recalc-tiers', {
    method: 'POST',
    body: JSON.stringify({ merchantId }),
  });
  if (!out.ok) return out.error;
  return out.data;
}
