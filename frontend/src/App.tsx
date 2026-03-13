import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { PosPage } from './pages/PosPage';
import { PosOrdersListPage } from './pages/PosOrdersListPage';
import { PosOrderDetailPage } from './pages/PosOrderDetailPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminInventoryAdjustPage } from './pages/admin/AdminInventoryAdjustPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminWarehousesStoresPage } from './pages/admin/AdminWarehousesStoresPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/pos/orders" element={<PosOrdersListPage />} />
      <Route path="/pos/orders/:id" element={<PosOrderDetailPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="inventory" replace />} />
        <Route path="inventory" element={<AdminInventoryPage />} />
        <Route path="inventory/adjust" element={<AdminInventoryAdjustPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="warehouses" element={<AdminWarehousesStoresPage />} />
        <Route path="stores" element={<Navigate to="/admin/warehouses" replace />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


