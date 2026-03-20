/**
 * customerApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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
  const url = `${API_BASE_URL.replace(/\/$/, '')}/customers/import/preview?merchantId=${encodeURIComponent(merchantId)}`;
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
  const url = `${API_BASE_URL.replace(/\/$/, '')}/customers/import/apply?merchantId=${encodeURIComponent(merchantId)}`;
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
