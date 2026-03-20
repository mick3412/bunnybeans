/**
 * POS Orders 真實 API 客戶端。
 * 依 docs/api-design-pos.md、docs/backend-error-format.md；僅呼叫 /pos/orders 與主檔 GET /stores、GET /products。
 */

import type {
  CreatePosOrderRequest,
  PosOrderDetail,
  PosOrderListResponse,
} from './posOrdersMockService';

const BASE_URL =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim() ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3003' : '');

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  code?: string;
  traceId?: string;
}

export interface CreateOrderResult {
  statusCode: number;
  message: string;
  body?: PosOrderDetail;
  code?: string;
  traceId?: string;
}

export interface StoreDto {
  id: string;
  code: string;
  name: string;
  merchantId?: string;
  /** 至少一筆時 POS 建單才可扣庫；未綁倉的門市不應當作預設收銀門市 */
  warehouseIds?: string[];
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  /** 後端 Decimal 字串；POS 售價以此為準 */
  salePrice?: string;
  categoryId?: string;
  brandId?: string;
  tags?: string[];
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
}

/** GET /pos/products 回傳：產品基本欄位 + 門市倉庫彙總 onHandQty */
export interface PosProductWithStockDto extends ProductDto {
  onHandQty: number;
}

export function productDtoSalePriceNumber(p: ProductDto): number {
  const n = Number(p.salePrice);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export interface BrandDto {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryDto {
  id: string;
  code: string;
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

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    return {
      ok: false,
      error: {
        statusCode: 0,
        message: (e as Error)?.message ?? 'Failed to fetch',
        code: 'NETWORK_ERROR',
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
        error: err.error as string | undefined,
        code: err.code as string | undefined,
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

/** GET /customers?merchantId= 唯讀；POS 選客戶顯示 memberLevel（與 seed 對齊） */
export type PosCustomerRow = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  memberLevel: string | null;
};
export async function listCustomersForPos(merchantId: string): Promise<PosCustomerRow[] | ApiError> {
  const qs = new URLSearchParams({ merchantId });
  const out = await request<PosCustomerRow[]>(`customers?${qs}`, {
    traceId: genTraceId(),
  });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** 供 POS 選預設門市：有 storeId 的倉庫對應可扣庫門市（舊後端未回傳 store.warehouseIds 時後備） */
export async function getWarehouses(traceId?: string): Promise<
  { id: string; storeId?: string | null }[] | ApiError
> {
  const out = await request<{ id: string; storeId?: string | null }[]>('warehouses', {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getBrands(traceId?: string): Promise<BrandDto[] | ApiError> {
  const out = await request<BrandDto[]>('brands', { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getProducts(
  params?: { categoryId?: string; brandId?: string; tag?: string; sku?: string },
  traceId?: string,
): Promise<ProductDto[] | ApiError> {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set('categoryId', params.categoryId);
  if (params?.brandId) q.set('brandId', params.brandId);
  if (params?.tag?.trim()) q.set('tag', params.tag.trim());
  if (params?.sku?.trim()) q.set('sku', params.sku.trim());
  const path = `products${q.toString() ? `?${q.toString()}` : ''}`;
  const out = await request<ProductDto[]>(path, { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /pos/products?storeId= — 產品列表含門市倉庫庫存（onHandQty） */
export async function getPosProducts(
  storeId: string,
  traceId?: string,
): Promise<PosProductWithStockDto[] | ApiError> {
  const id = storeId?.trim();
  if (!id) return { statusCode: 400, message: 'storeId required', code: 'POS_PRODUCTS_STORE_REQUIRED' };
  const out = await request<PosProductWithStockDto[]>(`pos/products?storeId=${encodeURIComponent(id)}`, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /products/search-barcode?q= — 條碼精確查詢（回 { items }） */
export async function searchProductsByBarcode(
  q: string,
  limit = 20,
  traceId?: string,
): Promise<{ items: ProductDto[] } | ApiError> {
  const term = q.trim();
  if (!term) return { items: [] };
  const qs = new URLSearchParams({ q: term, limit: String(limit) });
  const out = await request<{ items: ProductDto[] }>(`products/search-barcode?${qs}`, { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  const items = Array.isArray(out.data.items) ? out.data.items : [];
  return { items };
}

export async function getCategories(traceId?: string): Promise<CategoryDto[] | ApiError> {
  const out = await request<CategoryDto[]>('categories', { traceId: traceId ?? genTraceId() });
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface MemberContributionDto {
  memberRevenue: number;
  memberOrdersCount: number;
  guestRevenue: number;
  guestOrdersCount: number;
}

export interface PosReportsSummaryDto {
  totalRevenue: string;
  ordersCount: number;
  avgOrder: string;
  refundsCount: number;
  refundsTotal: string;
  period?: { preset?: string; from: string; to: string };
  byPaymentMethod?: Record<string, number>;
  byCategory?: { categoryId: string | null; categoryCode?: string; revenue: number }[];
  /** 區間銷貨成本（costPrice 彙總）；後端有 costPrice 時才有 */
  totalCost?: string;
  /** 毛利 = totalRevenue - totalCost */
  grossMargin?: string;
  /** 毛利率 % */
  grossMarginRate?: number | null;
  /** 會員 vs 匿名客營收與訂單數 */
  memberContribution?: MemberContributionDto;
}

export type PosReportsPreset =
  | 'today'
  | 'last7d'
  | 'last30d'
  | 'currentMonth'
  | 'last60d'
  | 'lastHalfYear';

export interface GetPosReportsSummaryParams {
  preset?: PosReportsPreset;
  from?: string;
  to?: string;
  storeId?: string;
  merchantId?: string;
}

export async function getPosReportsSummary(
  params?: GetPosReportsSummaryParams,
  traceId?: string,
): Promise<PosReportsSummaryDto | ApiError> {
  const q = new URLSearchParams();
  if (params?.preset) q.set('preset', params.preset);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.storeId) q.set('storeId', params.storeId);
  if (params?.merchantId) q.set('merchantId', params.merchantId);
  const path = `pos/reports/summary${q.toString() ? `?${q.toString()}` : ''}`;
  const out = await request<PosReportsSummaryDto>(path, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export interface PosTopItemRow {
  productId: string;
  sku?: string;
  name?: string;
  quantity: number;
  revenue: number;
}

export async function getPosTopItems(
  params: { from: string; to: string; storeId?: string; limit?: number; sortBy?: 'quantity' | 'revenue'; merchantId?: string },
  traceId?: string,
): Promise<PosTopItemRow[] | ApiError> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.storeId) q.set('storeId', params.storeId);
  if (params.merchantId) q.set('merchantId', params.merchantId);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.sortBy) q.set('sortBy', params.sortBy);
  const out = await request<{ items: PosTopItemRow[]; from?: string; to?: string }>(`pos/reports/top-items?${q.toString()}`, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  const data = out.data as { items?: Array<PosTopItemRow & { productName?: string }> };
  const raw = Array.isArray(data?.items) ? data.items : [];
  return raw.map((r) => ({
    productId: r.productId,
    sku: r.sku,
    name: r.name ?? r.productName,
    quantity: r.quantity,
    revenue: r.revenue,
  }));
}

export interface PosDailyRow {
  date: string;
  revenue: number;
  ordersCount: number;
}

/** 統一圖表格式：{ label, value }[] */
export type PosDailyChartItem = { label: string; value: number };

export async function getPosDaily(
  params: {
    from: string;
    to: string;
    storeId?: string;
    merchantId?: string;
    groupBy?: 'day' | 'week' | 'month' | 'hour';
  },
  traceId?: string,
): Promise<PosDailyChartItem[] | ApiError> {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.storeId) q.set('storeId', params.storeId);
  if (params.merchantId) q.set('merchantId', params.merchantId);
  if (params.groupBy) q.set('groupBy', params.groupBy);
  const out = await request<
    | PosDailyRow[]
    | { byDay?: PosDailyRow[] }
    | { items: { periodStart: string; revenue: number; ordersCount: number }[]; from?: string; to?: string; groupBy?: string }
  >(`pos/reports/daily?${q.toString()}`, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  const data = out.data;
  // 後端 groupBy=day 或未指定時回傳 byDay / 陣列；groupBy=week|month 時回傳 { items }
  if (Array.isArray(data)) {
    return (data as PosDailyRow[]).map((r) => ({ label: r.date, value: r.revenue }));
  }
  const byDay = (data as { byDay?: PosDailyRow[] }).byDay;
  if (Array.isArray(byDay)) {
    return byDay.map((r) => ({ label: r.date, value: r.revenue }));
  }
  const items = (data as { items?: { periodStart: string; revenue: number }[] }).items;
  if (Array.isArray(items)) {
    return items.map((r) => ({ label: r.periodStart, value: r.revenue }));
  }
  const byHour = (data as { byHour?: { hour: number; revenue: number }[] }).byHour;
  if (Array.isArray(byHour)) {
    return byHour.map((r) => ({ label: `${r.hour}時`, value: r.revenue }));
  }
  return [];
}

export interface OrderValueDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  revenue: number;
}

export async function getPosOrderValueDistribution(
  params: {
    preset?: PosReportsPreset;
    from?: string;
    to?: string;
    storeId?: string;
    merchantId?: string;
  },
  traceId?: string,
): Promise<{ buckets: OrderValueDistributionBucket[] } | ApiError> {
  const q = new URLSearchParams();
  if (params.preset) q.set('preset', params.preset);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.storeId) q.set('storeId', params.storeId);
  if (params.merchantId) q.set('merchantId', params.merchantId);
  const path = `pos/reports/order-value-distribution${q.toString() ? `?${q.toString()}` : ''}`;
  const out = await request<{ buckets: OrderValueDistributionBucket[] }>(path, {
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export interface PromotionPreviewResult {
  subtotal: number;
  discount: number;
  total: number;
  applied: { ruleId: string; name: string; discount: number; messages: string[] }[];
  messages: string[];
}

export async function previewPromotions(
  body: {
    storeId: string;
    customerId?: string | null;
    items: { productId: string; quantity: number; unitPrice: number }[];
  },
  traceId?: string,
): Promise<PromotionPreviewResult | ApiError> {
  const out = await request<PromotionPreviewResult>('pos/promotions/preview', {
    method: 'POST',
    body: JSON.stringify(body),
    traceId: traceId ?? genTraceId(),
  });
  if (!out.ok) return out.error;
  return out.data;
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
      code: out.error.code,
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

/** POST /pos/orders/:id/payments — 補款；成功回傳更新後 PosOrderDetail */
export async function appendOrderPayment(
  orderId: string,
  body: { method: string; amount: number; occurredAt?: string },
  traceId?: string,
): Promise<CreateOrderResult> {
  const tid = traceId ?? genTraceId();
  const out = await request<PosOrderDetail>(`pos/orders/${encodeURIComponent(orderId)}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
    traceId: tid,
  });
  if (!out.ok) {
    return {
      statusCode: out.error.statusCode,
      message: out.error.message,
      code: out.error.code,
      traceId: out.error.traceId,
    };
  }
  return { statusCode: 201, message: 'OK', body: out.data, traceId: tid };
}

/** POST /pos/orders/:id/refunds — 退款 SALE_REFUND；成功回傳更新後 PosOrderDetail */
export async function postRefund(
  orderId: string,
  body: { amount: number; occurredAt?: string; note?: string },
  traceId?: string,
): Promise<CreateOrderResult> {
  const tid = traceId ?? genTraceId();
  const out = await request<PosOrderDetail>(`pos/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: 'POST',
    body: JSON.stringify(body),
    traceId: tid,
  });
  if (!out.ok) {
    return {
      statusCode: out.error.statusCode,
      message: out.error.message,
      code: out.error.code,
      traceId: out.error.traceId,
    };
  }
  return { statusCode: 201, message: 'OK', body: out.data, traceId: tid };
}

/** POST /pos/orders/:id/return-to-stock — 退貨入庫 RETURN_FROM_CUSTOMER */
export async function postReturnToStock(
  orderId: string,
  body: {
    items: Array<{ productId: string; quantity: number }>;
    occurredAt?: string;
  },
  traceId?: string,
): Promise<CreateOrderResult> {
  const tid = traceId ?? genTraceId();
  const out = await request<PosOrderDetail>(
    `pos/orders/${encodeURIComponent(orderId)}/returns/stock`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      traceId: tid,
    },
  );
  if (!out.ok) {
    return {
      statusCode: out.error.statusCode,
      message: out.error.message,
      code: out.error.code,
      traceId: out.error.traceId,
    };
  }
  return { statusCode: 201, message: 'OK', body: out.data, traceId: tid };
}
