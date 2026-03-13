import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { PosPage } from './pages/PosPage';
import { PosOrdersListPage } from './pages/PosOrdersListPage';
import { PosOrderDetailPage } from './pages/PosOrderDetailPage';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/pos/orders" element={<PosOrdersListPage />} />
      <Route path="/pos/orders/:id" element={<PosOrderDetailPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};


