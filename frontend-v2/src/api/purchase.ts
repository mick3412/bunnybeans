import { api, type ApiError } from './client';

export type SupplierDto = {
  id: string;
  merchantId: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  status?: string;
};

export async function listSuppliers(merchantId: string, q?: string): Promise<SupplierDto[] | ApiError> {
  const params = new URLSearchParams({ merchantId });
  if (q?.trim()) params.set('q', q.trim());
  const out = await api<SupplierDto[]>(`suppliers?${params}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export type PurchaseOrderDto = {
  id: string;
  orderNumber: string;
  supplierId?: string;
  supplierName?: string | null;
  status?: string;
  expectedDate?: string | null;
};

export async function listPurchaseOrders(
  merchantId: string,
  opts?: { status?: string; q?: string },
): Promise<PurchaseOrderDto[] | ApiError> {
  const params = new URLSearchParams({ merchantId });
  if (opts?.status?.trim()) params.set('status', opts.status.trim());
  if (opts?.q?.trim()) params.set('q', opts.q.trim());
  const out = await api<PurchaseOrderDto[]>(`purchase-orders?${params}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export type ReceivingNoteDto = {
  id: string;
  number: string;
  purchaseOrderId?: string;
  poNumber?: string | null;
  supplierName?: string | null;
  status?: string;
};

export async function listReceivingNotes(
  merchantId: string,
  opts?: { status?: string; q?: string },
): Promise<ReceivingNoteDto[] | ApiError> {
  const params = new URLSearchParams({ merchantId });
  if (opts?.status?.trim()) params.set('status', opts.status.trim());
  if (opts?.q?.trim()) params.set('q', opts.q.trim());
  const out = await api<ReceivingNoteDto[]>(`receiving-notes?${params}`);
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}
