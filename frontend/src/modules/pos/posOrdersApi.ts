/**
 * POS Orders 真實 API 客戶端。
 * 依 docs/api-design-pos.md、docs/backend-error-format.md；僅呼叫 /pos/orders 與主檔 GET /stores、GET /products。
 */

import type {
  CreatePosOrderRequest,
  PosOrderDetail,
  PosOrderListResponse,
} from './posOrdersMockService';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  traceId?: string;
}

export interface CreateOrderResult {
  statusCode: number;
  message: string;
  body?: PosOrderDetail;
  traceId?: string;
}

export interface StoreDto {
  id: string;
  code: string;
  name: string;
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
}

export interface ListOrdersParams {
  storeId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

async function request<T>(
  path: string,
  options: RequestInit & { traceId?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const { traceId = genTraceId(), ...init } = options;
  const url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (traceId) {
    (headers as Record<string, string>)['X-Trace-Id'] = traceId;
  }

  const res = await fetch(url, { ...init, headers });
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
        error: err.error as string | undefined,
        traceId: (err.traceId as string) ?? traceId,
      },
    };
  }
  return { ok: true, data: body as T };
}

export async function getStores(traceId?: string): Promise<StoreDto[] | ApiError> {
  const out = await request<StoreDto[]>('stores', { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getProducts(traceId?: string): Promise<ProductDto[] | ApiError> {
  const out = await request<ProductDto[]>('products', { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createOrder(
  body: CreatePosOrderRequest,
  traceId?: string,
): Promise<CreateOrderResult> {
  const tid = traceId ?? genTraceId();
  const out = await request<PosOrderDetail>('pos/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    traceId: tid,
  });
  if (!out.ok) {
    return {
      statusCode: out.error.statusCode,
      message: out.error.message,
      traceId: out.error.traceId,
    };
  }
  return {
    statusCode: 201,
    message: 'OK',
    body: out.data,
    traceId: tid,
  };
}

export async function listOrders(
  params?: ListOrdersParams,
  traceId?: string,
): Promise<PosOrderListResponse | ApiError> {
  const q = new URLSearchParams();
  if (params?.storeId) q.set('storeId', params.storeId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = `pos/orders${q.toString() ? `?${q.toString()}` : ''}`;
  const out = await request<PosOrderListResponse>(path, { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return out.data;
}

export async function getOrderById(
  id: string,
  traceId?: string,
): Promise<PosOrderDetail | ApiError> {
  const out = await request<PosOrderDetail>(`pos/orders/${encodeURIComponent(id)}`, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return out.data;
}
