/**
 * Admin 後台 API — 依 docs/admin-inventory-ui.md、api-design-inventory-finance.md
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const ADMIN_API_KEY = (import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim() ?? '';

/** 與後端 AdminApiKeyGuard 一致：僅受保護的寫入需帶 X-Admin-Key */
function needsAdminKey(path: string, method: string): boolean {
  const m = (method || 'GET').toUpperCase();
  const p = path.replace(/^\//, '');
  if (p === 'inventory/events' && m === 'POST') return true;
  if (p === 'products' && m === 'POST') return true;
  if (p.startsWith('products/') && (m === 'PATCH' || m === 'DELETE')) return true;
  return false;
}

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  traceId?: string;
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
  (headers as Record<string, string>)['X-Trace-Id'] = traceId;
  if (ADMIN_API_KEY && needsAdminKey(path, init.method ?? 'GET')) {
    (headers as Record<string, string>)['X-Admin-Key'] = ADMIN_API_KEY;
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
        code: err.code as string | undefined,
        traceId: (err.traceId as string) ?? traceId,
      },
    };
  }
  return { ok: true, data: body as T };
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  merchantId: string;
  storeId?: string | null;
}

export async function getWarehouses(): Promise<WarehouseDto[] | ApiError> {
  const out = await request<WarehouseDto[]>('warehouses');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createWarehouse(body: {
  code: string;
  name: string;
  merchantId: string;
  storeId?: string | null;
}): Promise<WarehouseDto | ApiError> {
  const out = await request<WarehouseDto>('warehouses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateWarehouse(
  id: string,
  body: { code?: string; name?: string; storeId?: string | null },
): Promise<WarehouseDto | ApiError> {
  const out = await request<WarehouseDto>(`warehouses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteWarehouse(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`warehouses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

export interface BalanceEnrichedRow {
  productId: string;
  warehouseId: string;
  onHandQty: number;
  updatedAt: string;
  sku: string | null;
  name: string | null;
}

export async function getBalancesEnriched(
  warehouseId: string,
): Promise<BalanceEnrichedRow[] | ApiError> {
  const out = await request<BalanceEnrichedRow[]>(
    `inventory/balances/enriched?warehouseId=${encodeURIComponent(warehouseId)}`,
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface InventoryEventRow {
  id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  occurredAt: string;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface PagedEvents {
  items: InventoryEventRow[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getInventoryEvents(params: {
  warehouseId: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedEvents | ApiError> {
  const q = new URLSearchParams();
  q.set('warehouseId', params.warehouseId);
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<PagedEvents>(`inventory/events?${q}`);
  if (!out.ok) return out.error;
  return out.data;
}

export interface ProductFullDto {
  id: string;
  sku: string;
  name: string;
  categoryId?: string | null;
  brandId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getProducts(): Promise<ProductFullDto[] | ApiError> {
  const out = await request<ProductFullDto[]>('products');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createProduct(body: {
  sku: string;
  name: string;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
}): Promise<ProductFullDto | ApiError> {
  const out = await request<ProductFullDto>('products', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateProduct(
  id: string,
  body: {
    sku?: string;
    name?: string;
    categoryId?: string | null;
    brandId?: string | null;
    tags?: string[];
  },
): Promise<ProductFullDto | ApiError> {
  const out = await request<ProductFullDto>(`products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteProduct(id: string): Promise<{ success: boolean } | ApiError> {
  const out = await request<{ success: boolean }>(`products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
  return out.data;
}

export type InventoryEventType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_FROM_CUSTOMER'
  | 'RETURN_TO_SUPPLIER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS';

export async function postInventoryEvent(body: {
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt?: string;
  note?: string;
  referenceId?: string;
}): Promise<{ event: InventoryEventRow; balance: { onHandQty: number } } | ApiError> {
  const out = await request<{ event: InventoryEventRow; balance: { onHandQty: number } }>(
    'inventory/events',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
}
export interface BrandDto {
  id: string;
  code: string;
  name: string;
}

export async function getCategories(): Promise<CategoryDto[] | ApiError> {
  const out = await request<CategoryDto[]>('categories');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getBrands(): Promise<BrandDto[] | ApiError> {
  const out = await request<BrandDto[]>('brands');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** Merchant／Store — MerchantController */
export interface MerchantDto {
  id: string;
  code: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreDto {
  id: string;
  code: string;
  name: string;
  merchantId: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function listMerchants(): Promise<MerchantDto[] | ApiError> {
  const out = await request<MerchantDto[]>('merchants');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createMerchant(body: {
  code: string;
  name: string;
}): Promise<MerchantDto | ApiError> {
  const out = await request<MerchantDto>('merchants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateMerchant(
  id: string,
  body: { code?: string; name?: string },
): Promise<MerchantDto | ApiError> {
  const out = await request<MerchantDto>(`merchants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteMerchant(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`merchants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

export async function listStores(): Promise<StoreDto[] | ApiError> {
  const out = await request<StoreDto[]>('stores');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function createStore(body: {
  code: string;
  name: string;
  merchantId: string;
}): Promise<StoreDto | ApiError> {
  const out = await request<StoreDto>('stores', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateStore(
  id: string,
  body: { code?: string; name?: string },
): Promise<StoreDto | ApiError> {
  const out = await request<StoreDto>(`stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteStore(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`stores/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}
