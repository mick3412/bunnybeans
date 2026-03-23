/**
 * POS 掛單／取單 API 客戶端
 */
import { request } from '../admin/api/client';
import type { ApiError } from '../admin/api/client';
import type { CartItem } from './types';

export interface HeldCartItemDto {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface HeldCartDto {
  id: string;
  storeId: string;
  items: HeldCartItemDto[];
  subtotal: number;
  total: number;
  heldAt: string;
}

export interface RetrieveHeldCartResult {
  items: HeldCartItemDto[];
  subtotal: number;
  total: number;
}

export async function holdCart(
  storeId: string,
  items: CartItem[],
): Promise<HeldCartDto | ApiError> {
  const out = await request<HeldCartDto>('pos/held-carts', {
    method: 'POST',
    body: JSON.stringify({
      storeId,
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    }),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export async function listHeldCarts(storeId: string): Promise<HeldCartDto[] | ApiError> {
  const out = await request<HeldCartDto[]>(
    `pos/held-carts?storeId=${encodeURIComponent(storeId)}`,
  );
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export async function retrieveHeldCart(
  id: string,
): Promise<RetrieveHeldCartResult | ApiError> {
  const out = await request<RetrieveHeldCartResult>(
    `pos/held-carts/${encodeURIComponent(id)}/retrieve`,
    { method: 'POST' },
  );
  if (!out.ok) return out.error;
  return out.data;
}
