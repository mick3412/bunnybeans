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
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminWarehousesStoresPage } from './pages/admin/AdminWarehousesStoresPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminPromotionEditPage } from './pages/admin/AdminPromotionEditPage';
import { AdminCustomerImportPage } from './pages/admin/AdminCustomerImportPage';
import { AdminSuppliersPage } from './pages/admin/AdminSuppliersPage';
import { AdminPurchaseOrdersPage } from './pages/admin/AdminPurchaseOrdersPage';
import { AdminReceivingNotesPage } from './pages/admin/AdminReceivingNotesPage';

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
        <Route path="inventory/adjust" element={<AdminInventoryAdjustPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="warehouses" element={<AdminWarehousesStoresPage />} />
        <Route path="stores" element={<Navigate to="/admin/warehouses" replace />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="promotions/:id" element={<AdminPromotionEditPage />} />
        <Route path="customers/import" element={<AdminCustomerImportPage />} />
        <Route path="suppliers" element={<AdminSuppliersPage />} />
        <Route path="purchase-orders" element={<AdminPurchaseOrdersPage />} />
        <Route path="receiving-notes" element={<AdminReceivingNotesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


