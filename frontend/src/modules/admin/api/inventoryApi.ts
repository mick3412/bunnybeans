/**
 * inventoryApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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

export interface SlowMovingItem {
  productId: string;
  sku: string | null;
  name: string | null;
  soldQty: number;
  onHandQty: number;
  warehouseId: string | null;
}

export interface SlowMovingResult {
  items: SlowMovingItem[];
  from: string;
  to: string;
}

/** GET /inventory/slow-moving — 滯銷品（依 merchantId） */
export async function getSlowMoving(params: {
  merchantId: string;
  warehouseId?: string;
  lookbackDays?: number;
  salesThreshold?: number;
  onHandThreshold?: number;
}): Promise<SlowMovingResult | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.lookbackDays != null) q.set('lookbackDays', String(params.lookbackDays));
  if (params.salesThreshold != null) q.set('salesThreshold', String(params.salesThreshold));
  if (params.onHandThreshold != null) q.set('onHandThreshold', String(params.onHandThreshold));
  const out = await request<SlowMovingResult>(`inventory/slow-moving?${q.toString()}`);
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /inventory/events/batch-stocktake — 多品多倉盤點（Admin Key） */
export async function batchStocktake(body: {
  warehouseId: string;
  lines: { productId: string; actualQty: number }[];
}): Promise<{ ok: number; failed: { productId: string; reason: string }[] } | ApiError> {
  const out = await request<{ ok: number; failed: { productId: string; reason: string }[] }>(
    'inventory/events/batch-stocktake',
    {
      method: 'POST',
      body: JSON.stringify({
        warehouseId: body.warehouseId,
        lines: body.lines,
      }),
    },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export interface ExpiringBatchRow {
  productId: string;
  warehouseId: string;
  batchCode: string | null;
  expiryDate: string;
  onHandQty: number;
  sku: string | null;
  productName: string | null;
}

export interface ExpiringInventoryResult {
  items: ExpiringBatchRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ExpiringProductSummaryRow {
  productId: string;
  sku: string | null;
  productName: string | null;
  earliestExpiryDate: string;
  expiringQty: number;
  warehousesCount: number;
}

/** GET /inventory/expiring — 即將到期批次列表（依商品／倉庫過濾） */
export async function getExpiringInventory(params: {
  warehouseId?: string;
  productId?: string;
  from?: string;
  to?: string;
  daysAhead?: number;
  page?: number;
  pageSize?: number;
}): Promise<ExpiringInventoryResult | ApiError> {
  const q = new URLSearchParams();
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.productId) q.set('productId', params.productId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = q.toString() ? `inventory/expiring?${q}` : 'inventory/expiring';
  const out = await request<ExpiringInventoryResult>(path);
  if (!out.ok) return out.error;
  const data = out.data as unknown as ExpiringInventoryResult;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    page: typeof data.page === 'number' ? data.page : 1,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : data.items.length,
    total: typeof data.total === 'number' ? data.total : data.items.length,
  };
}

/** GET /inventory/expiring?groupBy=product — 依商品彙總即期庫存 */
export async function getExpiringInventorySummaryByProduct(params: {
  warehouseId?: string;
  from?: string;
  to?: string;
  daysAhead?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ExpiringProductSummaryRow[]; page: number; pageSize: number; total: number } | ApiError> {
  const q = new URLSearchParams();
  q.set('groupBy', 'product');
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<{ items: ExpiringProductSummaryRow[]; page: number; pageSize: number; total: number }>(
    `inventory/expiring?${q.toString()}`,
  );
  if (!out.ok) return out.error;
  const d = out.data as unknown as { items?: unknown; page?: unknown; pageSize?: unknown; total?: unknown };
  return {
    items: Array.isArray(d.items) ? (d.items as ExpiringProductSummaryRow[]) : [],
    page: typeof d.page === 'number' ? (d.page as number) : 1,
    pageSize: typeof d.pageSize === 'number' ? (d.pageSize as number) : 50,
    total: typeof d.total === 'number' ? (d.total as number) : (Array.isArray(d.items) ? d.items.length : 0),
  };
}

export type InventoryImportResult = { ok: number; failed: { row: number; reason: string }[] };

/** POST /inventory/events/import multipart **file**（CSV）；需 X-Admin-Key */
export async function importInventoryEventsCsv(
  file: File,
): Promise<InventoryImportResult | ApiError> {
  const traceId = genTraceId();
  const url = `${API_BASE_URL.replace(/\/$/, '')}/inventory/events/import`;
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

/** POST /purchase-orders/from-replenishment — 依補貨建議建立 DRAFT 採購單；API 未就緒時回 404 */
export async function createPurchaseOrderFromReplenishment(body: {
  supplierId: string;
  warehouseId: string;
  suggestions: Array<{ productId: string; suggestedQty: number }>;
}): Promise<{ id: string; orderNumber: string } | ApiError> {
  const out = await request<{ id: string; orderNumber: string }>(
    'purchase-orders/from-replenishment',
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!out.ok) return out.error;
  return out.data;
}

export interface ReplenishmentSuggestionRow {
  productId: string;
  warehouseId: string;
  onHandQty: number;
  avgDailySales: number;
  targetStock: number;
  suggestedQty: number;
  reason: string;
  sku: string | null;
  productName: string | null;
}

export interface ReplenishmentSuggestionResult {
  config: { daysLookback: number; daysAhead: number; safetyDays: number };
  items: ReplenishmentSuggestionRow[];
  page: number;
  pageSize: number;
  total: number;
}

/** GET /inventory/replenishment-suggestions — 補貨建議列表 */
export async function getReplenishmentSuggestions(params: {
  merchantId: string;
  warehouseId?: string;
  daysLookback?: number;
  daysAhead?: number;
  safetyDays?: number;
  minSuggestedQty?: number;
  page?: number;
  pageSize?: number;
}): Promise<ReplenishmentSuggestionResult | ApiError> {
  const q = new URLSearchParams();
  q.set('merchantId', params.merchantId);
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  if (params.daysLookback != null) q.set('daysLookback', String(params.daysLookback));
  if (params.daysAhead != null) q.set('daysAhead', String(params.daysAhead));
  if (params.safetyDays != null) q.set('safetyDays', String(params.safetyDays));
  if (params.minSuggestedQty != null) q.set('minSuggestedQty', String(params.minSuggestedQty));
  if (params.page != null) q.set('page', String(params.page));
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<ReplenishmentSuggestionResult>(`inventory/replenishment-suggestions?${q}`);
  if (!out.ok) return out.error;
  const data = out.data as unknown as ReplenishmentSuggestionResult;
  return {
    config: data.config,
    items: Array.isArray(data.items) ? data.items : [],
    page: data.page ?? 1,
    pageSize: data.pageSize ?? (Array.isArray(data.items) ? data.items.length : 0),
    total: data.total ?? (Array.isArray(data.items) ? data.items.length : 0),
  };
}
