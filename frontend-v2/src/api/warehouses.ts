import { api, type ApiError } from './client';

export type WarehouseDto = {
  id: string;
  code: string;
  name: string;
  merchantId?: string;
};

export async function listWarehouses(): Promise<WarehouseDto[] | ApiError> {
  const out = await api<WarehouseDto[]>('warehouses');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
