import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { PosLayout } from './pages/PosLayout';
import {
  PosAfterSalesPageLazy,
  PosOrderDetailPageLazy,
  PosOrdersListPageLazy,
  PosPageLazy,
  PosPromosPageLazy,
  PosReportsPageLazy,
} from './app/posLazy';
import { NotFoundPage } from './pages/NotFoundPage';
import {
  AdminCustomerImportPageLazy,
  AdminFinanceHubPageLazy,
  AdminPosSessionsPageLazy,
  AdminInventoryAdjustPageLazy,
  AdminInventoryQueryHubPageLazy,
  AdminLayoutLazy,
  AdminMarketingCenterHubPageLazy,
  AdminMarketingRuleEditPageLazy,
  AdminMemberCenterHubPageLazy,
  AdminOpsMonitoringHubPageLazy,
  AdminPerformancePageLazy,
  AdminProcurementHubPageLazy,
  AdminProductHubPageLazy,
  AdminQuickReceivingPageLazy,
  AdminSegmentExportPageLazy,
  AdminSuppliersPageLazy,
  AdminWarehousesStoresPageLazy,
} from './app/adminLazy';

const adminRouteFallback = (
  <div className="flex min-h-[50vh] items-center justify-center bg-forge-main text-sm text-muted" role="status">
    載入後台…
  </div>
);

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pos" element={<ErrorBoundary><PosLayout /></ErrorBoundary>}>
        <Route index element={<PosPageLazy />} />
        <Route path="orders" element={<PosOrdersListPageLazy />} />
        <Route path="orders/:id" element={<PosOrderDetailPageLazy />} />
        <Route path="after-sales" element={<PosAfterSalesPageLazy />} />
        <Route path="promos" element={<PosPromosPageLazy />} />
        <Route path="reports" element={<PosReportsPageLazy />} />
      </Route>
      <Route
        path="/admin"
        element={
          <ErrorBoundary>
            <Suspense fallback={adminRouteFallback}>
              <AdminLayoutLazy />
            </Suspense>
          </ErrorBoundary>
        }
      >
        <Route index element={<AdminOpsMonitoringHubPageLazy initialTab="overview" />} />
        <Route path="inventory" element={<AdminInventoryQueryHubPageLazy initialTab="balances" />} />
        <Route path="inventory/expiring" element={<AdminInventoryQueryHubPageLazy initialTab="expiring" />} />
        <Route path="inventory/adjust" element={<AdminInventoryQueryHubPageLazy initialTab="adjust" />} />
        <Route path="products" element={<AdminProductHubPageLazy initialTab="products" />} />
        <Route path="warehouses" element={<AdminInventoryQueryHubPageLazy initialTab="warehouses" />} />
        <Route path="stores" element={<AdminInventoryQueryHubPageLazy initialTab="warehouses" />} />
        <Route path="categories" element={<AdminProductHubPageLazy initialTab="categories" />} />
        <Route path="discount-tags" element={<AdminProductHubPageLazy initialTab="discountTags" />} />
        <Route path="reports" element={<AdminFinanceHubPageLazy initialTab="reports" />} />
        <Route path="balances" element={<AdminFinanceHubPageLazy initialTab="balances" />} />
        <Route path="promotions" element={<AdminMarketingCenterHubPageLazy initialTab="promotions" />} />
        <Route path="promotions/:id" element={<AdminMarketingCenterHubPageLazy initialTab="promotions" />} />
        <Route path="customers" element={<AdminMemberCenterHubPageLazy initialTab="members" />} />
        <Route path="customers/import" element={<AdminCustomerImportPageLazy />} />
        <Route path="segments" element={<AdminMarketingCenterHubPageLazy initialTab="segments" />} />
        <Route path="segments/export" element={<AdminSegmentExportPageLazy />} />
        <Route path="dispatch-rules" element={<AdminMarketingCenterHubPageLazy initialTab="dispatchRules" />} />
        <Route path="crm/jobs" element={<AdminMarketingCenterHubPageLazy initialTab="jobs" />} />
        <Route path="finance/periods" element={<AdminFinanceHubPageLazy initialTab="periods" />} />
        <Route path="finance/audit" element={<AdminFinanceHubPageLazy initialTab="audit" />} />
        <Route path="finance/snapshots" element={<AdminFinanceHubPageLazy initialTab="snapshots" />} />
        <Route path="pos/sessions" element={<AdminPosSessionsPageLazy />} />
        <Route path="performance" element={<AdminPerformancePageLazy />} />
        <Route path="ops/jobs" element={<AdminOpsMonitoringHubPageLazy initialTab="jobs" />} />
        <Route path="ops/report-clicks" element={<AdminOpsMonitoringHubPageLazy initialTab="clicks" />} />
        <Route path="marketing/rules" element={<AdminMarketingCenterHubPageLazy initialTab="marketingRules" />} />
        <Route path="marketing/rules/new" element={<AdminMarketingRuleEditPageLazy />} />
        <Route path="marketing/rules/:id" element={<AdminMarketingRuleEditPageLazy />} />
        <Route path="suppliers" element={<AdminSuppliersPageLazy />} />
        <Route path="procurement" element={<AdminProcurementHubPageLazy initialTab="purchaseOrders" />} />
        <Route path="purchase-orders" element={<AdminProcurementHubPageLazy initialTab="purchaseOrders" />} />
        <Route path="purchase-orders/quick-receiving" element={<AdminQuickReceivingPageLazy />} />
        <Route path="receiving-notes" element={<AdminProcurementHubPageLazy initialTab="receivingNotes" />} />
        <Route path="replenishment" element={<AdminProcurementHubPageLazy initialTab="replenishment" />} />
        <Route path="loyalty" element={<AdminMemberCenterHubPageLazy initialTab="dashboard" />} />
        <Route path="loyalty/point-ledger" element={<AdminMemberCenterHubPageLazy initialTab="pointLedger" />} />
        <Route path="loyalty/coupons" element={<AdminMarketingCenterHubPageLazy initialTab="coupons" />} />
        <Route path="loyalty/reports" element={<AdminMemberCenterHubPageLazy initialTab="reports" />} />
        <Route path="loyalty/settings" element={<AdminMemberCenterHubPageLazy initialTab="settings" />} />
        <Route path="loyalty/tier-rules" element={<AdminMemberCenterHubPageLazy initialTab="tierRules" />} />
        <Route path="loyalty/promotions" element={<Navigate to="/admin/promotions" replace />} />
        <Route path="loyalty/members" element={<Navigate to="/admin/customers" replace />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
