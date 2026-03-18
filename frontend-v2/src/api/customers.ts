import type { ApiError } from './client';

const BASE =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? '' : '');
const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

function traceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

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
  const url = `${BASE.replace(/\/$/, '')}/customers/import/preview?merchantId=${encodeURIComponent(merchantId)}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId() };
  if (ADMIN_KEY) headers['X-Admin-Key'] = ADMIN_KEY;
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
      traceId: (err.traceId as string) ?? undefined,
    };
  }
  const data = body as CustomerImportPreviewResult;
  if (typeof data?.fileHash !== 'string' || !Array.isArray(data?.rows)) {
    return { statusCode: 500, message: 'invalid preview response' };
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

export async function applyCustomersImport(
  file: File,
  merchantId: string,
  fileHash: string,
  decisions: CustomerImportApplyDecision[],
): Promise<CustomerImportApplyResult | ApiError> {
  const url = `${BASE.replace(/\/$/, '')}/customers/import/apply?merchantId=${encodeURIComponent(merchantId)}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId() };
  if (ADMIN_KEY) headers['X-Admin-Key'] = ADMIN_KEY;
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
      traceId: (err.traceId as string) ?? undefined,
    };
  }
  const data = body as CustomerImportApplyResult;
  if (
    typeof data?.created !== 'number' ||
    typeof data?.updated !== 'number' ||
    typeof data?.skipped !== 'number' ||
    !Array.isArray(data?.failed)
  ) {
    return { statusCode: 500, message: 'invalid apply response' };
  }
  return data;
}
