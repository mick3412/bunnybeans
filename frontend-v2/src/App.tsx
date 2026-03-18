import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './shell/AppShell';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminInventoryAdjustPage } from './pages/admin/AdminInventoryAdjustPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminWarehousesPage } from './pages/admin/AdminWarehousesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminPromotionEditPage } from './pages/admin/AdminPromotionEditPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminCustomerImportPage } from './pages/admin/AdminCustomerImportPage';
import { AdminSuppliersPage } from './pages/admin/AdminSuppliersPage';
import { AdminPurchaseOrdersPage } from './pages/admin/AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from './pages/admin/AdminReceivingNotesPage';
import { LoyaltyDashboardPage } from './pages/admin/loyalty/LoyaltyDashboardPage';
import { LoyaltyPointLedgerPage } from './pages/admin/loyalty/LoyaltyPointLedgerPage';
import { LoyaltyMembersPage } from './pages/admin/loyalty/LoyaltyMembersPage';
import { LoyaltyCouponsPage } from './pages/admin/loyalty/LoyaltyCouponsPage';
import { LoyaltySettingsPage } from './pages/admin/loyalty/LoyaltySettingsPage';
import { PosPage } from './pages/pos/PosPage';
import { PosOrdersListPage } from './pages/pos/PosOrdersListPage';
import { PosOrderDetailPage } from './pages/pos/PosOrderDetailPage';
import { PosPromosPage } from './pages/pos/PosPromosPage';
import { PosReportsPage } from './pages/pos/PosReportsPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pos" element={<AppShell mode="pos" />}>
        <Route index element={<PosPage />} />
        <Route path="orders" element={<PosOrdersListPage />} />
        <Route path="orders/:id" element={<PosOrderDetailPage />} />
        <Route path="promos" element={<PosPromosPage />} />
        <Route path="reports" element={<PosReportsPage />} />
      </Route>
      <Route path="/admin" element={<AppShell mode="admin" />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="inventory/adjust" element={<AdminInventoryAdjustPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="warehouses" element={<AdminWarehousesPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="promotions/:id" element={<AdminPromotionEditPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="customers/import" element={<AdminCustomerImportPage />} />
        <Route path="suppliers" element={<AdminSuppliersPage />} />
        <Route path="purchase-orders" element={<AdminPurchaseOrdersPage />} />
        <Route path="receiving-notes" element={<AdminReceivingNotesPage />} />
        <Route path="loyalty" element={<LoyaltyDashboardPage />} />
        <Route path="loyalty/point-ledger" element={<LoyaltyPointLedgerPage />} />
        <Route path="loyalty/members" element={<LoyaltyMembersPage />} />
        <Route path="loyalty/coupons" element={<LoyaltyCouponsPage />} />
        <Route path="loyalty/settings" element={<LoyaltySettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};
