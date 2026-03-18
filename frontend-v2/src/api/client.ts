const BASE =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? '' : '');
const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

function traceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

export type ApiError = { statusCode: number; message: string; traceId?: string };

export async function api<T>(
  path: string,
  init?: RequestInit & { needAdminKey?: boolean },
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const url = `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceId(),
  };
  if (ADMIN_KEY && init?.needAdminKey) headers['X-Admin-Key'] = ADMIN_KEY;
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
        traceId: (b.traceId as string) ?? undefined,
      },
    };
  }
  return { ok: true, data: body as T };
}
