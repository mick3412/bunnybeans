import { api, type ApiError } from './client';

export type DashboardSummaryDto = {
  productCount: number;
  skuOutOfStockCount: number;
  skuLowStockCount: number;
  ordersTodayCount: number;
  totalOnHandUnits: number;
  inventoryValueApprox: string;
  lowStockThreshold: number;
};

export async function getDashboardSummary(): Promise<DashboardSummaryDto | ApiError> {
  const out = await api<DashboardSummaryDto>('admin/dashboard/summary');
  if (!out.ok) return out.error;
  return out.data;
}
