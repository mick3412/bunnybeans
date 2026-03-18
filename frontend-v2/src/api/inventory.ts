import { api, type ApiError } from './client';

export type InventoryEventType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'RETURN_FROM_CUSTOMER'
  | 'RETURN_TO_SUPPLIER'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'STOCKTAKE_GAIN'
  | 'STOCKTAKE_LOSS';

export interface RecordInventoryEventInput {
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt?: string;
  referenceId?: string;
  note?: string;
}

export interface RecordedInventoryEvent {
  id: string;
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt: string;
  referenceId?: string;
  note?: string;
  createdAt: string;
}

export async function postInventoryEvent(
  body: RecordInventoryEventInput,
): Promise<RecordedInventoryEvent | ApiError> {
  const out = await api<RecordedInventoryEvent>('inventory/events', {
    method: 'POST',
    body: JSON.stringify(body),
    needAdminKey: true,
  });
  if (!out.ok) return out.error;
  return out.data;
}
