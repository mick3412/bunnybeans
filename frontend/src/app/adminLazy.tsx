import { lazy } from 'react';

/** Admin 區域路由級 code splitting（INSTRUCTIONS 033） */
export const AdminLayoutLazy = lazy(() =>
  import('../pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
export const AdminPerformancePageLazy = lazy(() =>
  import('../pages/admin/AdminPerformancePage').then((m) => ({ default: m.AdminPerformancePage })),
);
export const AdminInventoryQueryHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminInventoryQueryHubPage').then((m) => ({
    default: m.AdminInventoryQueryHubPage,
  })),
);
export const AdminInventoryAdjustPageLazy = lazy(() =>
  import('../pages/admin/AdminInventoryAdjustPage').then((m) => ({ default: m.AdminInventoryAdjustPage })),
);
export const AdminWarehousesStoresPageLazy = lazy(() =>
  import('../pages/admin/AdminWarehousesStoresPage').then((m) => ({ default: m.AdminWarehousesStoresPage })),
);
export const AdminFinanceHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminFinanceHubPage').then((m) => ({ default: m.AdminFinanceHubPage })),
);
export const AdminProductHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminProductHubPage').then((m) => ({ default: m.AdminProductHubPage })),
);
export const AdminOpsMonitoringHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminOpsMonitoringHubPage').then((m) => ({
    default: m.AdminOpsMonitoringHubPage,
  })),
);
export const AdminProcurementHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminProcurementHubPage').then((m) => ({
    default: m.AdminProcurementHubPage,
  })),
);
export const AdminSegmentExportPageLazy = lazy(() =>
  import('../pages/admin/AdminSegmentExportPage').then((m) => ({ default: m.AdminSegmentExportPage })),
);
export const AdminCustomerImportPageLazy = lazy(() =>
  import('../pages/admin/AdminCustomerImportPage').then((m) => ({ default: m.AdminCustomerImportPage })),
);
export const AdminSuppliersPageLazy = lazy(() =>
  import('../pages/admin/AdminSuppliersPage').then((m) => ({ default: m.AdminSuppliersPage })),
);
export const AdminQuickReceivingPageLazy = lazy(() =>
  import('../pages/admin/AdminQuickReceivingPage').then((m) => ({ default: m.AdminQuickReceivingPage })),
);
export const AdminMarketingRuleEditPageLazy = lazy(() =>
  import('../pages/admin/AdminMarketingRuleEditPage').then((m) => ({ default: m.AdminMarketingRuleEditPage })),
);
export const AdminMemberCenterHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminMemberCenterHubPage').then((m) => ({
    default: m.AdminMemberCenterHubPage,
  })),
);
export const AdminMarketingCenterHubPageLazy = lazy(() =>
  import('../pages/admin/hubs/AdminMarketingCenterHubPage').then((m) => ({
    default: m.AdminMarketingCenterHubPage,
  })),
);
