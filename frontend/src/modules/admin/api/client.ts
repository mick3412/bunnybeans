/**
 * Admin API 共用：Base URL、request、CSV 匯出、ApiError
 */
export const API_BASE_URL =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3003' : '');

const ADMIN_API_KEY_ENV = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

function getAdminApiKey(): string {
  if (ADMIN_API_KEY_ENV) return ADMIN_API_KEY_ENV;
  try {
    return (localStorage.getItem('admin-api-key') ?? '').trim();
  } catch {
    return '';
  }
}

/** 僅供 legacy 匯入/外部檔案使用；請優先呼叫 getAdminApiKey() */
export const ADMIN_API_KEY = ADMIN_API_KEY_ENV;

/**
 * 與後端 AdminApiKeyGuard 一致：統一規則
 * - 非 GET（POST/PATCH/PUT/DELETE 等）一律帶 X-Admin-Key（若已設定環境變數）
 * - GET 僅下列路徑需帶 Key（匯出、部分後台唯讀）
 */
function needsAdminKey(path: string, method: string): boolean {
  const m = (method || 'GET').toUpperCase();
  const p = path.replace(/^\//, '');
  const pathOnly = p.split('?')[0];
  if (m !== 'GET') {
    return true;
  }
  if (pathOnly === 'inventory/balances/export') return true;
  if (pathOnly === 'inventory/events/export') return true;
  if (pathOnly === 'finance/events/export') return true;
  if (pathOnly === 'products/export') return true;
  if (pathOnly === 'customers/export') return true;
  if (pathOnly === 'pos/orders/export') return true;
  if (/^imports\/jobs\/.+/.test(pathOnly)) return true;
  if (pathOnly === 'merchant/current') return true;
  if (pathOnly === 'crm/segments') return true;
  if (/^crm\/segments\/[^/]+\/export$/.test(pathOnly)) return true;
  if (/^crm\/jobs\/[^/]+$/.test(pathOnly)) return true;
  if (pathOnly === 'loyalty/reports/activity') return true;
  if (pathOnly === 'loyalty/reports/members') return true;
  if (pathOnly === 'finance/periods') return true;
  if (pathOnly === 'finance/audit-log') return true;
  if (pathOnly === 'finance/snapshots') return true;
  if (/^finance\/snapshots\/[^/]+$/.test(pathOnly)) return true;
  if (/^finance\/snapshots\/[^/]+\/download$/.test(pathOnly)) return true;
  if (pathOnly === 'crm/dispatch-rules') return true;
  if (pathOnly === 'ops/reports/click-audit') return true;
  if (pathOnly === 'ops/reports/click-audit/summary') return true;
  return false;
}

export function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

/** CSV 下載（後端回 text/csv，非 JSON） */
export async function fetchCsvExport(
  pathWithQuery: string,
  filename: string,
): Promise<true | ApiError> {
  const traceId = genTraceId();
  const path = pathWithQuery.replace(/^\//, '');
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  const adminKey = getAdminApiKey();
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) message = j.message;
    } catch {
      /* ignore */
    }
    return { statusCode: res.status, message, traceId };
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  traceId?: string;
}

export async function request<T>(
  path: string,
  options: RequestInit & { traceId?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const { traceId = genTraceId(), ...init } = options;
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  (headers as Record<string, string>)['X-Trace-Id'] = traceId;
  const adminKey = getAdminApiKey();
  if (adminKey && needsAdminKey(path, init.method ?? 'GET')) {
    (headers as Record<string, string>)['X-Admin-Key'] = adminKey;
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch';
    return {
      ok: false,
      error: {
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: msg,
        traceId,
      },
    };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const err = body as Record<string, unknown>;
    return {
      ok: false,
      error: {
        statusCode: res.status,
        message: (err.message as string) ?? res.statusText,
        code: err.code as string | undefined,
        traceId: (err.traceId as string) ?? traceId,
      },
    };
  }
  return { ok: true, data: body as T };
}
