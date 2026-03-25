/**
 * POS 收銀班次 API — 開班／日結
 * GET /pos/sessions/current、POST /pos/sessions/open、POST /pos/sessions/:id/close、GET /pos/sessions
 */
import { request } from '../admin/api/client';
import type { ApiError } from '../admin/api/client';

export interface SessionReportDto {
  period: { from: string; to: string };
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  byPaymentMethod?: Record<string, number>;
  ordersCount: number;
  refundsCount: number;
}

export interface CashRegisterSessionDto {
  id: string;
  storeId: string;
  merchantId: string;
  openedAt: string;
  closedAt?: string;
  openingCashAmount: number;
  expectedCashAmount?: number;
  actualCashAmount?: number;
  differenceAmount?: number;
  openedBy?: string;
  closedBy?: string;
  status: string;
  note?: string;
  storeCode?: string;
  storeName?: string;
  report?: SessionReportDto;
}

/** GET /pos/sessions/current?storeId= — 該門市目前 OPEN 的 session */
export async function getCurrentSession(
  storeId: string,
): Promise<(CashRegisterSessionDto & { report: SessionReportDto }) | null | ApiError> {
  const out = await request<CashRegisterSessionDto & { report: SessionReportDto } | null>(
    `pos/sessions/current?storeId=${encodeURIComponent(storeId)}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /pos/sessions/open — 開班 */
export async function openSession(input: {
  storeId: string;
  openingCashAmount: number;
  openedBy?: string;
}): Promise<CashRegisterSessionDto | ApiError> {
  const out = await request<CashRegisterSessionDto>('pos/sessions/open', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!out.ok) return out.error;
  return out.data;
}

/** POST /pos/sessions/:id/close — 結班 */
export async function closeSession(
  id: string,
  input: { actualCashAmount: number; closedBy?: string; note?: string },
): Promise<(CashRegisterSessionDto & { report: SessionReportDto }) | ApiError> {
  const out = await request<CashRegisterSessionDto & { report: SessionReportDto }>(
    `pos/sessions/${encodeURIComponent(id)}/close`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /pos/sessions — 歷史班次列表 */
export async function listSessions(params?: {
  storeId?: string;
  merchantId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: CashRegisterSessionDto[]; total: number } | ApiError> {
  const q = new URLSearchParams();
  if (params?.storeId) q.set('storeId', params.storeId);
  if (params?.merchantId) q.set('merchantId', params.merchantId);
  if (params?.status) q.set('status', params.status);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
  const out = await request<{ items: CashRegisterSessionDto[]; total: number }>(
    `pos/sessions${q.toString() ? `?${q.toString()}` : ''}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}

/** GET /pos/sessions/:id — 單筆詳情 */
export async function getSessionById(
  id: string,
): Promise<(CashRegisterSessionDto & { report?: SessionReportDto }) | ApiError> {
  const out = await request<CashRegisterSessionDto & { report?: SessionReportDto }>(
    `pos/sessions/${encodeURIComponent(id)}`,
  );
  if (!out.ok) return out.error;
  return out.data;
}
