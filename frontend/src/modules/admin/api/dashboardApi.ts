/**
 * dashboardApi — 自 adminApi 拆分
 */
import { request, type ApiError, API_BASE_URL, ADMIN_API_KEY, genTraceId } from './client';

export interface DashboardSummaryDto {
  productCount: number;
  skuOutOfStockCount: number;
  skuLowStockCount: number;
  ordersTodayCount: number;
  totalOnHandUnits: number;
  inventoryValueApprox: string;
  lowStockThreshold: number;
}

export async function getDashboardSummary(): Promise<
  DashboardSummaryDto | ApiError
> {
  const out = await request<DashboardSummaryDto>('admin/dashboard/summary');
  if (!out.ok) return out.error;
  return out.data;
}
