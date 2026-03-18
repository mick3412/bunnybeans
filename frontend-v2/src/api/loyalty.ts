import { api, type ApiError } from './client';

export type LoyaltySettingsDto = {
  merchantId: string;
  earnPerNT: number;
  pointValueNT: number;
  birthdayMultiplier: number;
  rollingDays: number;
  notifyDaysBefore: number;
};

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

export type LoyaltyDashboardDto = {
  pointsIssued30d: number;
  pointsRedeemed30d: number;
  activeMembersWithPoints: number;
  circulatingPointsTotal?: number;
  newMembersThisMonth?: number;
  recentLedger?: Array<{
    id: string;
    customerId: string;
    customerName: string;
    type: string;
    amount: number;
    balanceAfter: number;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  activePromotions?: Array<{
    id: string;
    name: string;
    usageCount: number;
    startsAt: string | null;
    endsAt: string | null;
  }>;
};

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

export async function getLoyaltySettings(merchantId: string): Promise<LoyaltySettingsDto | ApiError> {
  const out = await api<LoyaltySettingsDto>(`loyalty/settings?merchantId=${encodeURIComponent(merchantId)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function patchLoyaltySettings(
  merchantId: string,
  body: Partial<Pick<LoyaltySettingsDto, 'earnPerNT' | 'pointValueNT' | 'birthdayMultiplier' | 'rollingDays' | 'notifyDaysBefore'>>,
): Promise<LoyaltySettingsDto | ApiError> {
  const out = await api<LoyaltySettingsDto>(
    `loyalty/settings?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'PATCH', body: JSON.stringify(body), needAdminKey: true },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export async function getPointLedger(
  merchantId: string,
  customerId: string | undefined,
  limit = 100,
): Promise<{ items: LedgerItemDto[] } | ApiError> {
  const q = new URLSearchParams({ merchantId, limit: String(limit) });
  if (customerId?.trim()) q.set('customerId', customerId.trim());
  const out = await api<{ items: LedgerItemDto[] }>(`loyalty/point-ledger?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function getLoyaltyDashboard(merchantId: string): Promise<LoyaltyDashboardDto | ApiError> {
  const out = await api<LoyaltyDashboardDto>(`loyalty/dashboard?merchantId=${encodeURIComponent(merchantId)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function listLoyaltyCustomers(
  merchantId: string,
  opts?: { status?: string; tag?: string },
): Promise<LoyaltyCustomerRow[] | ApiError> {
  const q = new URLSearchParams({ merchantId });
  if (opts?.status?.trim()) q.set('status', opts.status.trim());
  if (opts?.tag?.trim()) q.set('tag', opts.tag.trim());
  const out = await api<LoyaltyCustomerRow[]>(`customers?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

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
  const out = await api<{ items: CustomerSearchItem[] }>(`customers/search?${params}`);
  if (!out.ok) return out.error;
  return { items: Array.isArray(out.data?.items) ? out.data.items : [] };
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

export async function listLoyaltyCoupons(merchantId: string): Promise<{ items: LoyaltyCouponDto[] } | ApiError> {
  const out = await api<{ items: LoyaltyCouponDto[] }>(`loyalty/coupons?merchantId=${encodeURIComponent(merchantId)}`);
  if (!out.ok) return out.error;
  return out.data;
}
