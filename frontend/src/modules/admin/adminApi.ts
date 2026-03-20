/**
 * Admin 後台 API — 依 domain 拆分至 `./api/*`，此檔為相容用 barrel re-export（INSTRUCTIONS 033）
 */
export type { ApiError } from './api/client';
export { fetchCsvExport, genTraceId, API_BASE_URL, ADMIN_API_KEY } from './api/client';

export * from './api/crmApi';
export * from './api/opsApi';
export * from './api/financeApi';
export * from './api/dashboardApi';
export * from './api/inventoryApi';
export * from './api/productApi';
export * from './api/customerApi';
export * from './api/importsApi';
export * from './api/catalogApi';
export * from './api/merchantApi';
export * from './api/promotionApi';
