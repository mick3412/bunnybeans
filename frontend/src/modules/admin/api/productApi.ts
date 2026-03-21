/**
 * productApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

export interface ProductFullDto {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
  productionDate?: string | null;
  shelfLifeMonths?: number | null;
  expiryDate?: string | null;
  /** @deprecated use specStyle */
  specColor?: string | null;
  /** @deprecated use specWeight */
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

export async function getProducts(params?: {
  search?: string;
  sku?: string;
  categoryId?: string;
  brandId?: string;
  tag?: string;
  minDaysUntilExpiry?: number;
}): Promise<ProductFullDto[] | ApiError> {
  const q = new URLSearchParams();
  if (params?.search?.trim()) q.set('search', params.search.trim());
  if (params?.sku?.trim()) q.set('sku', params.sku.trim());
  if (params?.categoryId?.trim()) q.set('categoryId', params.categoryId.trim());
  if (params?.brandId?.trim()) q.set('brandId', params.brandId.trim());
  if (params?.tag?.trim()) q.set('tag', params.tag.trim());
  if (params?.minDaysUntilExpiry != null && Number.isFinite(params.minDaysUntilExpiry) && params.minDaysUntilExpiry >= 0) {
    q.set('minDaysUntilExpiry', String(Math.floor(params.minDaysUntilExpiry)));
  }
  const path = q.toString() ? `products?${q.toString()}` : 'products';
  const out = await request<ProductFullDto[]>(path);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /products/search-barcode?q= — 條碼精確查詢（回 { items }） */
export async function searchProductsByBarcode(
  q: string,
  limit = 20,
): Promise<{ items: ProductFullDto[] } | ApiError> {
  const term = q.trim();
  if (!term) return { items: [] };
  const qs = new URLSearchParams({ q: term, limit: String(limit) });
  const out = await request<{ items: ProductFullDto[] }>(`products/search-barcode?${qs}`);
  if (!out.ok) return out.error;
  return { items: Array.isArray(out.data.items) ? out.data.items : [] };
}

export async function createProduct(body: {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  specSize?: string | null;
  specCapacity?: string | null;
  specStyle?: string | null;
  specWeight?: string | null;
  expiryDescription?: string | null;
  productionDate?: string | null;
  shelfLifeMonths?: number | null;
  expiryDate?: string | null;
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

/** PATCH /products/batch-tags — 批次改標籤（append，不覆蓋既有；Admin Key） */
export async function batchUpdateProductTags(body: {
  productIds: string[];
  tags: string[];
  operation?: 'add' | 'set';
}): Promise<{ updated: number } | ApiError> {
  const out = await request<{ updated: number }>('products/batch-tags', {
    method: 'PATCH',
    body: JSON.stringify({
      productIds: body.productIds,
      tags: body.tags,
      operation: body.operation ?? 'add',
    }),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** PATCH /products/batch-price — 批次改價（Admin Key；後端未上線時可能 404/501） */
export async function batchUpdateProductPrice(body: {
  productIds: string[];
  salePrice: string | number;
}): Promise<{ updated: number } | ApiError> {
  const out = await request<{ updated: number }>('products/batch-price', {
    method: 'PATCH',
    body: JSON.stringify({
      productIds: body.productIds,
      salePrice: String(body.salePrice),
    }),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateProduct(
  id: string,
  body: {
    sku?: string;
    barcode?: string | null;
    name?: string;
    description?: string | null;
    specSize?: string | null;
    specCapacity?: string | null;
    specStyle?: string | null;
    specWeight?: string | null;
    expiryDescription?: string | null;
    productionDate?: string | null;
    shelfLifeMonths?: number | null;
    expiryDate?: string | null;
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

/** GET /product-tags；回傳 ProductTagDto[] */
export interface ProductTagDto {
  id: string;
  name: string;
  code?: string | null;
  showInPosDiscount?: boolean;
  autoCondition?: { type: string; lookbackDays?: number; minQty?: number; minPercent?: number; maxQty?: number; withinDays?: number } | null;
}
export async function listProductTags(merchantId: string): Promise<ProductTagDto[] | ApiError> {
  const out = await request<ProductTagDto[]>(`product-tags?merchantId=${encodeURIComponent(merchantId)}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

/** GET /product-tags/for-pos-discount — POS 折扣篩選選項 */
export async function listProductTagsForPosDiscount(merchantId: string): Promise<{ id: string; name: string; code: string }[] | ApiError> {
  const out = await request<{ id: string; name: string; code: string }[]>(
    `product-tags/for-pos-discount?merchantId=${encodeURIComponent(merchantId)}`,
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
/** 取得標籤名稱列表（供商品頁下拉用） */
export async function getProductTags(merchantId: string): Promise<string[] | ApiError> {
  const arr = await listProductTags(merchantId);
  if (!Array.isArray(arr)) return arr;
  return arr.map((t) => t.name ?? t.code ?? '').filter(Boolean);
}
export async function createProductTag(
  merchantId: string,
  body: { name: string; code?: string | null; showInPosDiscount?: boolean; autoCondition?: unknown },
): Promise<ProductTagDto | ApiError> {
  const out = await request<ProductTagDto>('product-tags', {
    method: 'POST',
    body: JSON.stringify({ merchantId, ...body }),
  });
  if (!out.ok) return out.error;
  return out.data;
}
export async function updateProductTag(
  id: string,
  body: { name?: string; code?: string; showInPosDiscount?: boolean; autoCondition?: unknown },
): Promise<ProductTagDto | ApiError> {
  const out = await request<ProductTagDto>(`product-tags/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}
export async function deleteProductTag(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`product-tags/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!out.ok) return out.error;
}

/** PATCH /product-tags/reorder — 拖曳排序；body: { merchantId: string; ids: string[] } */
export async function reorderProductTags(
  merchantId: string,
  ids: string[],
): Promise<void | ApiError> {
  const out = await request<unknown>('product-tags/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ merchantId, ids }),
  });
  if (!out.ok) return out.error;
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
  const url = `${API_BASE_URL.replace(/\/$/, '')}/products/import`;
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
