import { api, type ApiError } from './client';

export type StoreDto = { id: string; code: string; name: string; merchantId?: string };

export async function getStores(): Promise<StoreDto[] | ApiError> {
  const out = await api<StoreDto[]>('stores');
  if (!out.ok) return out.error;
  return Array.isArray(out.data) ? out.data : [];
}

export type CreatePosOrderBody = {
  storeId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  payments: Array<{ method: string; amount: number }>;
  occurredAt?: string;
  customerId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  allowCredit?: boolean;
  pointsToRedeem?: number;
};

export async function createOrder(body: CreatePosOrderBody): Promise<PosOrderDetail | ApiError> {
  const out = await api<PosOrderDetail>('pos/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!out.ok) return out.error;
  return out.data;
}

export type PosOrderSummary = {
  id: string;
  orderNumber: string;
  storeId?: string;
  occurredAt: string;
  totalAmount: string;
  status?: string;
};

export type PosOrderListResponse = {
  items: PosOrderSummary[];
  page: number;
  pageSize: number;
  total?: number;
};

export type PosOrderDetailItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal?: string;
};

export type PosOrderDetailPayment = {
  method: string;
  amount: number;
};

export type PosOrderDetail = PosOrderSummary & {
  items: PosOrderDetailItem[];
  payments: PosOrderDetailPayment[];
  paidAmount: number;
  remainingAmount: number;
};

export async function listOrders(params?: {
  storeId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<PosOrderListResponse | ApiError> {
  const q = new URLSearchParams();
  if (params?.storeId) q.set('storeId', params.storeId);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  const path = `pos/orders${q.toString() ? `?${q}` : ''}`;
  const out = await api<PosOrderListResponse>(path);
  if (!out.ok) return out.error;
  return out.data;
}

export async function getOrderById(id: string): Promise<PosOrderDetail | ApiError> {
  const out = await api<PosOrderDetail>(`pos/orders/${encodeURIComponent(id)}`);
  if (!out.ok) return out.error;
  return out.data;
}

export type PosReportsSummaryDto = {
  totalRevenue?: string;
  ordersCount?: number;
  avgOrder?: string;
  refundsCount?: number;
  refundsTotal?: string;
};

export async function getPosReportsSummary(): Promise<PosReportsSummaryDto | ApiError> {
  const out = await api<PosReportsSummaryDto>('pos/reports/summary');
  if (!out.ok) return out.error;
  return out.data;
}
