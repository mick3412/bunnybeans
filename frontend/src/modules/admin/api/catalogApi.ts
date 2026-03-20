/**
 * catalogApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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

/** PATCH /categories/reorder — 拖曳排序；body: { ids: string[] } */
export async function reorderCategories(ids: string[]): Promise<void | ApiError> {
  const out = await request<unknown>('categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
  if (!out.ok) return out.error;
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

export async function createBrand(body: { code: string; name: string }): Promise<BrandDto | ApiError> {
  const out = await request<BrandDto>('brands', { method: 'POST', body: JSON.stringify(body) });
  if (!out.ok) return out.error;
  return out.data;
}

export async function updateBrand(
  id: string,
  body: { code?: string; name?: string },
): Promise<BrandDto | ApiError> {
  const out = await request<BrandDto>(`brands/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function deleteBrand(id: string): Promise<void | ApiError> {
  const out = await request<unknown>(`brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!out.ok) return out.error;
}

/** PATCH /brands/reorder — 拖曳排序；body: { ids: string[] } */
export async function reorderBrands(ids: string[]): Promise<void | ApiError> {
  const out = await request<unknown>('brands/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
  if (!out.ok) return out.error;
}
