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
  if (p === 'inventory/transfer' && m === 'POST') return true;
  if (p === 'products' && m === 'POST') return true;
  if (p === 'products/import' && m === 'POST') return true;
  if (p.startsWith('products/') && (m === 'PATCH' || m === 'DELETE')) return true;
  if (p === 'categories' && m === 'POST') return true;
  if (/^categories\/.+/.test(p) && m === 'PATCH') return true;
  if (/^categories\/.+/.test(p) && m === 'DELETE') return true;
  if (p === 'promotion-rules' && m === 'POST') return true;
  if (p === 'promotion-rules/reorder/bulk' && m === 'PATCH') return true;
  if (/^promotion-rules\/.+/.test(p) && m === 'PATCH') return true;
  if (/^promotion-rules\/.+/.test(p) && m === 'DELETE') return true;
  if (p === 'inventory/balances/export' && m === 'GET') return true;
  if (p === 'finance/events/export' && m === 'GET') return true;
  if (p === 'inventory/events/export' && m === 'GET') return true;
  const pathOnly = p.split('?')[0];
  if (pathOnly === 'pos/orders/export' && m === 'GET') return true;
  if (pathOnly === 'inventory/events/import' && m === 'POST') return true;
  if (pathOnly === 'customers/import/preview' && m === 'POST') return true;
  if (pathOnly === 'customers/import/apply' && m === 'POST') return true;
  if (m === 'POST' && /^imports\/jobs\/(products_csv|inventory_csv)$/.test(pathOnly)) return true;
  if (m === 'GET' && /^imports\/jobs\/.+/.test(pathOnly)) return true;
  return false;
}

function genTraceId(): string {
  return crypto.randomUUID?.() ?? `tr-${Date.now()}`;
}

/** CSV 下載（後端回 text/csv，非 JSON） */
export async function fetchCsvExport(
  pathWithQuery: string,
  filename: string,
): Promise<true | ApiError> {
  const traceId = genTraceId();
  const path = pathWithQuery.replace(/^\//, '');
  const url = `${BASE_URL.replace(/\/$/, '')}/${path}`;
  const headers: Record<string, string> = { 'X-Trace-Id': traceId };
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
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

export interface DashboardSummaryDto {
  productCount: number;
  skuOutOfStockCount: number;
  skuLowStockCount: number;
  ordersTodayCount: number;
  totalOnHandUnits: number;
  inventoryValueApprox: string;
  lowStockThreshold: number;
}

export async function getDashboardSummary(): Promise<
  DashboardSummaryDto | ApiError
> {
  const out = await request<DashboardSummaryDto>('admin/dashboard/summary');
  if (!out.ok) return out.error;
  return out.data;
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

export interface InventoryBalanceRow {
  id: string;
  productId: string;
  warehouseId: string;
  onHandQty: number;
  updatedAt: string;
}

export async function getInventoryBalances(params?: {
  productId?: string;
  warehouseId?: string;
}): Promise<InventoryBalanceRow[] | ApiError> {
  const q = new URLSearchParams();
  if (params?.productId) q.set('productId', params.productId);
  if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
  const qs = q.toString();
  const out = await request<InventoryBalanceRow[]>(
    qs ? `inventory/balances?${qs}` : 'inventory/balances',
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface ProductFullDto {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string;
  salePrice?: string;
  costPrice?: string | null;
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
  description?: string | null;
  specSize?: string | null;
  specColor?: string | null;
  weightGrams?: number | null;
  listPrice?: string | number | null;
  salePrice?: string | number | null;
  costPrice?: string | number | null;
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
    description?: string | null;
    specSize?: string | null;
    specColor?: string | null;
    weightGrams?: number | null;
    listPrice?: string | number | null;
    salePrice?: string | number | null;
    costPrice?: string | number | null;
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

export type ProductImportResult = {
  ok: number;
  failed: { row: number; reason: string }[];
};

/** POST /products/import multipart field **file**（CSV）；需 X-Admin-Key */
export async function importProductsCsv(
  file: File,
): Promise<ProductImportResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/products/import`;
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
  const data = body as ProductImportResult;
  if (typeof data?.ok !== 'number' || !Array.isArray(data?.failed)) {
    return {
      statusCode: 500,
      message: 'invalid import response',
      traceId,
    };
  }
  return data;
}

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
  const url = `${BASE_URL.replace(/\/$/, '')}/customers/import/preview?merchantId=${encodeURIComponent(merchantId)}`;
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
  const url = `${BASE_URL.replace(/\/$/, '')}/customers/import/apply?merchantId=${encodeURIComponent(merchantId)}`;
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
  const url = `${BASE_URL.replace(/\/$/, '')}/imports/jobs/${kind}`;
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

export type InventoryImportResult = { ok: number; failed: { row: number; reason: string }[] };

/** POST /inventory/events/import multipart **file**（CSV）；需 X-Admin-Key */
export async function importInventoryEventsCsv(
  file: File,
): Promise<InventoryImportResult | ApiError> {
  const traceId = genTraceId();
  const url = `${BASE_URL.replace(/\/$/, '')}/inventory/events/import`;
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
  const data = body as InventoryImportResult;
  if (typeof data?.ok !== 'number' || !Array.isArray(data?.failed)) {
    return { statusCode: 500, message: 'invalid import response', traceId };
  }
  return data;
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

export async function postInventoryTransfer(body: {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string;
  occurredAt?: string;
}): Promise<
  | {
      referenceId: string;
      balances: { from: { warehouseId: string; onHandQty: number }; to: { warehouseId: string; onHandQty: number } };
    }
  | ApiError
> {
  const out = await request<{
    referenceId: string;
    balances: { from: { warehouseId: string; onHandQty: number }; to: { warehouseId: string; onHandQty: number } };
  }>('inventory/transfer', { method: 'POST', body: JSON.stringify(body) });
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

/** GET /categories/enriched — 含商品數等（唯讀） */
export async function getCategoriesEnriched(): Promise<
  (CategoryDto & { productCount?: number })[] | ApiError
> {
  const out = await request<(CategoryDto & { productCount?: number })[]>('categories/enriched');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export interface FinanceEventRow {
  id: string;
  type: string;
  partyId: string;
  currency: string;
  amount: number;
  taxAmount: number | null;
  occurredAt: string;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface PagedFinanceEvents {
  items: FinanceEventRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** GET /finance/events — 公開；preset=last30d 近 30 日 */
export async function getFinanceEvents(params?: {
  preset?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<PagedFinanceEvents | ApiError> {
  const q = new URLSearchParams();
  if (params?.preset) q.set('preset', params.preset);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params?.type) q.set('type', params.type);
  const qs = q.toString();
  const out = await request<PagedFinanceEvents>(qs ? `finance/events?${qs}` : 'finance/events');
  if (!out.ok) return out.error;
  return out.data;
}

export async function createCategory(body: {
  code: string;
  name: string;
}): Promise<CategoryDto | ApiError> {
  const out = await request<CategoryDto>('categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateCategory(
  id: string,
  body: { code?: string; name?: string },
): Promise<CategoryDto | ApiError> {
  const out = await request<CategoryDto>(`categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** 後端若已上 DELETE /categories/:id 再使用；否則 404 */
export async function deleteCategory(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
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

export interface PromotionRuleDto {
  id: string;
  merchantId: string;
  name: string;
  priority: number;
  draft: boolean;
  startsAt: string | null;
  endsAt: string | null;
  exclusive: boolean;
  firstPurchaseOnly: boolean;
  memberLevels: string[];
  conditions: unknown[];
  actions: unknown[];
  status: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export async function listPromotionRules(params: {
  merchantId: string;
  status?: string;
  q?: string;
}): Promise<PromotionRuleDto[] | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.status) q.set('status', params.status);
  if (params.q) q.set('q', params.q);
  const out = await request<PromotionRuleDto[]>(`promotion-rules?${q}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function getPromotionRule(id: string): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export async function createPromotionRule(body: {
  merchantId: string;
  name: string;
  priority?: number;
  draft?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  exclusive?: boolean;
  firstPurchaseOnly?: boolean;
  memberLevels?: string[];
  conditions?: unknown[];
  actions?: unknown[];
}): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>('promotion-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data as PromotionRuleDto;
}

export async function updatePromotionRule(
  id: string,
  body: {
    merchantId: string;
    name?: string;
    priority?: number;
    draft?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    exclusive?: boolean;
    firstPurchaseOnly?: boolean;
    memberLevels?: string[];
    conditions?: unknown[];
    actions?: unknown[];
  },
): Promise<PromotionRuleDto | ApiError> {
  const out = await request<PromotionRuleDto>(`promotion-rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data as PromotionRuleDto;
}

export async function deletePromotionRule(
  id: string,
  merchantId: string,
): Promise<void | ApiError> {
  const out = await request<unknown>(
    `promotion-rules/${encodeURIComponent(id)}?merchantId=${encodeURIComponent(merchantId)}`,
    { method: 'DELETE' },
  );
  if (!out.ok) return out.error;
}

export async function reorderPromotionRules(
  merchantId: string,
  ids: string[],
): Promise<void | ApiError> {
  const out = await request<unknown>('promotion-rules/reorder/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ merchantId, ids }),
  });
  if (!out.ok) return out.error;
}
