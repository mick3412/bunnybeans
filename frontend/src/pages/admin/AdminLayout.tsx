import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import { AdminToastProvider } from './AdminToastContext';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-100'
  }`;

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  return (
    <AdminToastProvider>
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 flex items-center gap-2">
          <span className="rounded bg-violet-600 px-2 py-0.5 text-xs font-bold text-white">
            ADMIN
          </span>
          <span className="text-sm font-semibold text-slate-800">後台</span>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/admin/inventory" className={navClass} end>
            庫存餘額
          </NavLink>
          <NavLink to="/admin/inventory/adjust" className={navClass}>
            入庫／盤點
          </NavLink>
          <NavLink to="/admin/products" className={navClass}>
            商品主檔
          </NavLink>
          <NavLink to="/admin/categories" className={navClass}>
            分類
          </NavLink>
          <NavLink to="/admin/warehouses" className={navClass}>
            倉庫與門市
          </NavLink>
          <NavLink to="/admin/reports" className={navClass}>
            金流報表
          </NavLink>
        </nav>
        <div className="mt-8 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/pos')}>
            回 POS
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 p-6">
        <Outlet />
      </div>
    </div>
    </AdminToastProvider>
  );
};
