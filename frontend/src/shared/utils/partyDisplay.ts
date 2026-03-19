/**
 * Party 顯示輔助（依 docs/api-design-inventory-finance.md §5.0c）
 * - 優先使用 API 回傳的 displayName
 * - 以 kind 為主，相容 customer:/supplier: 小寫前綴
 */

const KIND_LABELS: Record<string, string> = {
  customer: '會員',
  supplier: '供應商',
};

/** 判斷 partyId 前綴（相容 CUSTOMER:/customer:、SUPPLIER:/supplier:） */
export function getPartyKindFromId(partyId: string): 'customer' | 'supplier' | '' {
  const lower = (partyId ?? '').trim().toLowerCase();
  if (lower.startsWith('customer:')) return 'customer';
  if (lower.startsWith('supplier:')) return 'supplier';
  return '';
}

/** 取得 kind 對應中文標籤 */
export function getKindLabel(kind: string | undefined): string {
  if (!kind) return '';
  const k = kind.toLowerCase();
  return KIND_LABELS[k] ?? '';
}

/**
 * 產生 Party 顯示名稱：displayName 優先，必要時加 kind 標籤
 * @param displayName API 回傳的 displayName
 * @param kind API 回傳的 kind
 * @param partyId 用於 fallback 解析
 * @param partyNames 本地查表（customer/supplier 名稱，含小寫前綴）
 */
export function formatPartyDisplay(
  displayName: string | undefined,
  kind: string | undefined,
  partyId: string,
  partyNames?: Record<string, string>,
): string {
  const pid = (partyId ?? '').trim();
  const k = (kind ?? getPartyKindFromId(pid)).toLowerCase();
  const label = getKindLabel(k);

  if (displayName?.trim()) {
    return label ? `${displayName.trim()} (${label})` : displayName.trim();
  }

  const [, refId] = pid.includes(':') ? pid.split(':', 2) : ['', pid];
  const fallback = partyNames?.[pid] ?? partyNames?.[refId] ?? refId ?? pid;
  if (!fallback || fallback === pid) return pid || '—';
  return label ? `${fallback} (${label})` : fallback;
}

/** 判斷 partyId 是否屬於 customer（相容大小寫前綴） */
export function isCustomerParty(partyId: string): boolean {
  return getPartyKindFromId(partyId) === 'customer';
}

/** 判斷 partyId 是否屬於 supplier（相容大小寫前綴） */
export function isSupplierParty(partyId: string): boolean {
  return getPartyKindFromId(partyId) === 'supplier';
}
