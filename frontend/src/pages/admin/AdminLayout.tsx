import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AdminToastProvider } from './AdminToastContext';

/** Forge：選中 = 近黑底 + 左線主色；未選 = 淺灰字 + hover 微亮 */
const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-r-lg border-l-[3px] py-2.5 pl-3 pr-3 text-sm font-medium leading-snug transition-colors',
    isActive
      ? 'border-brand-primary bg-forge-sidebar-active text-white'
      : 'border-transparent text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200',
  ].join(' ');

function headerTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return '總覽';
  if (pathname.startsWith('/admin/inventory/adjust')) return '入庫／盤點';
  if (pathname.startsWith('/admin/inventory')) return '庫存餘額';
  if (pathname.startsWith('/admin/products')) return '商品主檔';
  if (pathname.startsWith('/admin/categories')) return '分類';
  if (pathname.startsWith('/admin/warehouses')) return '倉庫與門市';
  if (pathname.startsWith('/admin/reports')) return '金流報表';
  if (pathname.includes('/admin/promotions/new')) return '新增促銷';
  if (pathname.match(/\/admin\/promotions\/[^/]+/)) return '編輯促銷';
  if (pathname.startsWith('/admin/promotions')) return '促銷規則';
  if (pathname.startsWith('/admin/customers/import')) return '客戶 CSV';
  if (pathname.startsWith('/admin/suppliers')) return '供應商管理';
  if (pathname.startsWith('/admin/purchase-orders')) return '採購單管理';
  if (pathname.startsWith('/admin/receiving-notes')) return '進貨驗收';
  if (pathname.startsWith('/admin/merchants')) return '商家主檔';
  return '後台';
}

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const title = useMemo(() => headerTitle(location.pathname), [location.pathname]);
  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  return (
    <AdminToastProvider>
      <div className="flex min-h-screen bg-forge-main">
        <aside className="sticky top-0 flex h-screen max-h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-forge-sidebar">
          <div className="shrink-0 border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
                P
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">POS ERP</span>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5">
            <NavLink to="/admin" className={navClass} end>
              總覽
            </NavLink>
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
            <NavLink to="/admin/promotions" className={navClass}>
              促銷規則
            </NavLink>
            <NavLink to="/admin/customers/import" className={navClass}>
              客戶 CSV
            </NavLink>
            <div className="flex items-center gap-2 px-3 pt-3 pb-1 text-[11px] font-semibold text-neutral-400">
              <svg className="h-4 w-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              採購
            </div>
            <NavLink to="/admin/suppliers" className={navClass}>
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                供應商
              </span>
            </NavLink>
            <NavLink to="/admin/purchase-orders" className={navClass}>
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                採購單
              </span>
            </NavLink>
            <NavLink to="/admin/receiving-notes" className={navClass}>
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                進貨驗收
              </span>
            </NavLink>
          </nav>
          <div className="shrink-0 border-t border-white/10 px-2 py-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              onClick={() => navigate('/pos')}
            >
              <svg className="h-5 w-5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              回收銀
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-forge-main">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-neutral-200/80 bg-forge-card px-6 shadow-sm">
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
              <span className="hidden shrink-0 text-sm text-neutral-500 sm:inline tabular-nums">{dateStr}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative hidden md:block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  type="search"
                  placeholder="搜尋…"
                  className="w-48 rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 shadow-sm lg:w-64"
                  readOnly
                  aria-label="搜尋（尚未連線）"
                />
              </div>
              <button
                type="button"
                className="relative rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
                aria-label="通知"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
              </button>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white"
                aria-hidden
              >
                AD
              </div>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto bg-forge-main p-6 text-[0.9375rem] leading-normal">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
};
