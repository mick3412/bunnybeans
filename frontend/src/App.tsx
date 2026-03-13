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
import { AdminWarehousesPage } from './pages/admin/AdminWarehousesPage';
import { AdminMerchantsPage } from './pages/admin/AdminMerchantsPage';
import { AdminStoresPage } from './pages/admin/AdminStoresPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';

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
        <Route path="warehouses" element={<AdminWarehousesPage />} />
        <Route path="merchants" element={<AdminMerchantsPage />} />
        <Route path="stores" element={<AdminStoresPage />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


