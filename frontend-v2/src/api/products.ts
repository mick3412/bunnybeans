import { api, type ApiError } from './client';

export type ProductDto = {
  id: string;
  sku: string;
  name: string;
  salePrice?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  tags?: string[];
};

export async function listProducts(params?: {
  search?: string;
  sku?: string;
  categoryId?: string;
  brandId?: string;
  tag?: string;
}): Promise<ProductDto[] | ApiError> {
  const q = new URLSearchParams();
  if (params?.search?.trim()) q.set('search', params.search.trim());
  if (params?.sku?.trim()) q.set('sku', params.sku.trim());
  if (params?.categoryId?.trim()) q.set('categoryId', params.categoryId.trim());
  if (params?.brandId?.trim()) q.set('brandId', params.brandId.trim());
  if (params?.tag?.trim()) q.set('tag', params.tag.trim());
  const path = q.toString() ? `products?${q}` : 'products';
  const out = await api<ProductDto[]>(path);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
