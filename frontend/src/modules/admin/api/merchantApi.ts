/**
 * merchantApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

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

/** §9 GET /merchant/current — 單一商家，回傳 { id, code, name }；失敗 404/400。 */
export type MerchantCurrentDto = { id: string; code?: string; name?: string };

export async function getMerchantCurrent(): Promise<MerchantCurrentDto | ApiError> {
  const out = await request<MerchantCurrentDto>('merchant/current');
  if (!out.ok) return out.error;
  return out.data;
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
