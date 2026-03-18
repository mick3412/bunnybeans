import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { PosLayout } from './pages/PosLayout';
import { PosPage } from './pages/PosPage';
import { PosOrdersListPage } from './pages/PosOrdersListPage';
import { PosOrderDetailPage } from './pages/PosOrderDetailPage';
import { PosPromosPage } from './pages/PosPromosPage';
import { PosReportsPage } from './pages/PosReportsPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminInventoryAdjustPage } from './pages/admin/AdminInventoryAdjustPage';
import { AdminExpiringInventoryPage } from './pages/admin/AdminExpiringInventoryPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminWarehousesStoresPage } from './pages/admin/AdminWarehousesStoresPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminFinanceBalancesPage } from './pages/admin/AdminFinanceBalancesPage';
import { AdminSegmentExportPage } from './pages/admin/AdminSegmentExportPage';
import { AdminSegmentsPage } from './pages/admin/AdminSegmentsPage';
import { AdminDispatchRulesPage } from './pages/admin/AdminDispatchRulesPage';
import { AdminFinancePeriodsPage } from './pages/admin/AdminFinancePeriodsPage';
import { AdminFinanceAuditPage } from './pages/admin/AdminFinanceAuditPage';
import { AdminFinanceSnapshotsPage } from './pages/admin/AdminFinanceSnapshotsPage';
import { AdminOpsJobsPage } from './pages/admin/AdminOpsJobsPage';
import { AdminOpsReportClicksPage } from './pages/admin/AdminOpsReportClicksPage';
import { LoyaltyReportActivityPage } from './pages/admin/LoyaltyReportActivityPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminCustomerImportPage } from './pages/admin/AdminCustomerImportPage';
import { AdminSuppliersPage } from './pages/admin/AdminSuppliersPage';
import { AdminPurchaseOrdersPage } from './pages/admin/AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from './pages/admin/AdminReceivingNotesPage';
import { AdminReplenishmentPage } from './pages/admin/AdminReplenishmentPage';
import { AdminQuickReceivingPage } from './pages/admin/AdminQuickReceivingPage';
import { AdminCrmJobsPage } from './pages/admin/AdminCrmJobsPage';
import { AdminMarketingRulesPage } from './pages/admin/AdminMarketingRulesPage';
import { AdminMarketingRuleEditPage } from './pages/admin/AdminMarketingRuleEditPage';
import { LoyaltyLayout } from './pages/admin/loyalty/LoyaltyLayout';
import { LoyaltyDashboardPage } from './pages/admin/loyalty/LoyaltyDashboardPage';
import { LoyaltyPointLedgerPage } from './pages/admin/loyalty/LoyaltyPointLedgerPage';
import { LoyaltyCouponsPage } from './pages/admin/loyalty/LoyaltyCouponsPage';
import { LoyaltySettingsPage } from './pages/admin/loyalty/LoyaltySettingsPage';
import { LoyaltyTierRulesPage } from './pages/admin/loyalty/LoyaltyTierRulesPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pos" element={<PosLayout />}>
        <Route index element={<PosPage />} />
        <Route path="orders" element={<PosOrdersListPage />} />
        <Route path="orders/:id" element={<PosOrderDetailPage />} />
        <Route path="promos" element={<PosPromosPage />} />
        <Route path="reports" element={<PosReportsPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="inventory/expiring" element={<AdminExpiringInventoryPage />} />
        <Route path="inventory/adjust" element={<AdminInventoryAdjustPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="warehouses" element={<AdminWarehousesStoresPage />} />
        <Route path="stores" element={<Navigate to="/admin/warehouses" replace />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="balances" element={<AdminFinanceBalancesPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="promotions/:id" element={<AdminPromotionsPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="customers/import" element={<AdminCustomerImportPage />} />
        <Route path="segments" element={<AdminSegmentsPage />} />
        <Route path="segments/export" element={<AdminSegmentExportPage />} />
        <Route path="dispatch-rules" element={<AdminDispatchRulesPage />} />
        <Route path="crm/jobs" element={<AdminCrmJobsPage />} />
        <Route path="finance/periods" element={<AdminFinancePeriodsPage />} />
        <Route path="finance/audit" element={<AdminFinanceAuditPage />} />
        <Route path="finance/snapshots" element={<AdminFinanceSnapshotsPage />} />
        <Route path="ops/jobs" element={<AdminOpsJobsPage />} />
        <Route path="ops/report-clicks" element={<AdminOpsReportClicksPage />} />
        <Route path="marketing/rules" element={<AdminMarketingRulesPage />} />
        <Route path="marketing/rules/new" element={<AdminMarketingRuleEditPage />} />
        <Route path="marketing/rules/:id" element={<AdminMarketingRuleEditPage />} />
        <Route path="suppliers" element={<AdminSuppliersPage />} />
        <Route path="purchase-orders" element={<AdminPurchaseOrdersPage />} />
        <Route path="purchase-orders/quick-receiving" element={<AdminQuickReceivingPage />} />
        <Route path="receiving-notes" element={<AdminReceivingNotesPage />} />
        <Route path="replenishment" element={<AdminReplenishmentPage />} />
        <Route path="loyalty" element={<LoyaltyLayout />}>
          <Route index element={<LoyaltyDashboardPage />} />
          <Route path="point-ledger" element={<LoyaltyPointLedgerPage />} />
          <Route path="promotions" element={<Navigate to="/admin/promotions" replace />} />
          <Route path="members" element={<Navigate to="/admin/customers" replace />} />
          <Route path="coupons" element={<LoyaltyCouponsPage />} />
          <Route path="reports" element={<LoyaltyReportActivityPage />} />
          <Route path="settings" element={<LoyaltySettingsPage />} />
          <Route path="tier-rules" element={<LoyaltyTierRulesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


