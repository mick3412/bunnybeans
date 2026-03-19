import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { PosLayout } from './pages/PosLayout';
import { PosPage } from './pages/PosPage';
import { PosOrdersListPage } from './pages/PosOrdersListPage';
import { PosOrderDetailPage } from './pages/PosOrderDetailPage';
import { PosPromosPage } from './pages/PosPromosPage';
import { PosReportsPage } from './pages/PosReportsPage';
import { AdminPerformancePage } from './pages/admin/AdminPerformancePage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminInventoryQueryHubPage } from './pages/admin/hubs/AdminInventoryQueryHubPage';
import { AdminInventoryAdjustPage } from './pages/admin/AdminInventoryAdjustPage';
import { AdminWarehousesStoresPage } from './pages/admin/AdminWarehousesStoresPage';
import { AdminFinanceHubPage } from './pages/admin/hubs/AdminFinanceHubPage';
import { AdminProductHubPage } from './pages/admin/hubs/AdminProductHubPage';
import { AdminOpsMonitoringHubPage } from './pages/admin/hubs/AdminOpsMonitoringHubPage';
import { AdminProcurementHubPage } from './pages/admin/hubs/AdminProcurementHubPage';
import { AdminSegmentExportPage } from './pages/admin/AdminSegmentExportPage';
import { AdminCustomerImportPage } from './pages/admin/AdminCustomerImportPage';
import { AdminSuppliersPage } from './pages/admin/AdminSuppliersPage';
import { AdminPurchaseOrdersPage } from './pages/admin/AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from './pages/admin/AdminReceivingNotesPage';
import { AdminReplenishmentPage } from './pages/admin/AdminReplenishmentPage';
import { AdminQuickReceivingPage } from './pages/admin/AdminQuickReceivingPage';
import { AdminMarketingRuleEditPage } from './pages/admin/AdminMarketingRuleEditPage';
import { AdminMemberCenterHubPage } from './pages/admin/hubs/AdminMemberCenterHubPage';
import { AdminMarketingCenterHubPage } from './pages/admin/hubs/AdminMarketingCenterHubPage';

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
        <Route index element={<AdminOpsMonitoringHubPage initialTab="overview" />} />
        <Route path="inventory" element={<AdminInventoryQueryHubPage initialTab="balances" />} />
        <Route path="inventory/expiring" element={<AdminInventoryQueryHubPage initialTab="expiring" />} />
        <Route path="inventory/adjust" element={<AdminInventoryAdjustPage />} />
        <Route path="products" element={<AdminProductHubPage initialTab="products" />} />
        <Route path="warehouses" element={<AdminWarehousesStoresPage />} />
        <Route path="stores" element={<Navigate to="/admin/warehouses" replace />} />
        <Route path="categories" element={<AdminProductHubPage initialTab="categories" />} />
        <Route path="reports" element={<AdminFinanceHubPage initialTab="reports" />} />
        <Route path="balances" element={<AdminFinanceHubPage initialTab="balances" />} />
        <Route path="promotions" element={<AdminMarketingCenterHubPage initialTab="promotions" />} />
        <Route path="promotions/:id" element={<AdminMarketingCenterHubPage initialTab="promotions" />} />
        <Route path="customers" element={<AdminMemberCenterHubPage initialTab="members" />} />
        <Route path="customers/import" element={<AdminCustomerImportPage />} />
        <Route path="segments" element={<AdminMemberCenterHubPage initialTab="segments" />} />
        <Route path="segments/export" element={<AdminSegmentExportPage />} />
        <Route path="dispatch-rules" element={<AdminMemberCenterHubPage initialTab="dispatchRules" />} />
        <Route path="crm/jobs" element={<AdminMarketingCenterHubPage initialTab="jobs" />} />
        <Route path="finance/periods" element={<AdminFinanceHubPage initialTab="periods" />} />
        <Route path="finance/audit" element={<AdminFinanceHubPage initialTab="audit" />} />
        <Route path="finance/snapshots" element={<AdminFinanceHubPage initialTab="snapshots" />} />
        <Route path="performance" element={<AdminPerformancePage />} />
        <Route path="ops/jobs" element={<AdminOpsMonitoringHubPage initialTab="jobs" />} />
        <Route path="ops/report-clicks" element={<AdminOpsMonitoringHubPage initialTab="clicks" />} />
        <Route path="marketing/rules" element={<AdminMarketingCenterHubPage initialTab="marketingRules" />} />
        <Route path="marketing/rules/new" element={<AdminMarketingRuleEditPage />} />
        <Route path="marketing/rules/:id" element={<AdminMarketingRuleEditPage />} />
        <Route path="suppliers" element={<AdminSuppliersPage />} />
        <Route path="procurement" element={<AdminProcurementHubPage initialTab="purchaseOrders" />} />
        <Route path="purchase-orders" element={<AdminProcurementHubPage initialTab="purchaseOrders" />} />
        <Route path="purchase-orders/quick-receiving" element={<AdminQuickReceivingPage />} />
        <Route path="receiving-notes" element={<AdminProcurementHubPage initialTab="receivingNotes" />} />
        <Route path="replenishment" element={<AdminProcurementHubPage initialTab="replenishment" />} />
        <Route path="loyalty" element={<AdminMemberCenterHubPage initialTab="dashboard" />} />
        <Route path="loyalty/point-ledger" element={<AdminMemberCenterHubPage initialTab="pointLedger" />} />
        <Route path="loyalty/coupons" element={<AdminMemberCenterHubPage initialTab="coupons" />} />
        <Route path="loyalty/reports" element={<AdminMemberCenterHubPage initialTab="reports" />} />
        <Route path="loyalty/settings" element={<AdminMemberCenterHubPage initialTab="settings" />} />
        <Route path="loyalty/tier-rules" element={<AdminMemberCenterHubPage initialTab="tierRules" />} />
        <Route path="loyalty/promotions" element={<Navigate to="/admin/promotions" replace />} />
        <Route path="loyalty/members" element={<Navigate to="/admin/customers" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


