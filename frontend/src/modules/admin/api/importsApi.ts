/**
 * importsApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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
  const url = `${API_BASE_URL.replace(/\/$/, '')}/imports/jobs/${kind}`;
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
