import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

type Mode = 'admin' | 'pos';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-r-md border-l-[3px] py-2 pl-3 pr-3 text-sm font-medium transition-colors',
    isActive
      ? 'border-[var(--color-primary)] bg-black/20 text-[var(--color-sidebar-text)]'
      : 'border-transparent text-[var(--color-sidebar-muted)] hover:bg-white/10 hover:text-[var(--color-sidebar-text)]',
  ].join(' ');

function adminTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return '總覽';
  if (pathname.startsWith('/admin/inventory/adjust')) return '入庫／盤點';
  if (pathname.startsWith('/admin/inventory')) return '庫存餘額';
  if (pathname.startsWith('/admin/products')) return '商品主檔';
  if (pathname.startsWith('/admin/categories')) return '分類';
  if (pathname.startsWith('/admin/warehouses')) return '倉庫與門市';
  if (pathname.startsWith('/admin/reports')) return '金流報表';
  if (pathname.match(/\/admin\/promotions\/[^/]+/)) return '編輯促銷';
  if (pathname.startsWith('/admin/promotions')) return '促銷規則';
  if (pathname.startsWith('/admin/customers/import')) return '客戶 CSV';
  if (pathname.startsWith('/admin/customers')) return '會員列表';
  if (pathname.startsWith('/admin/suppliers')) return '供應商';
  if (pathname.startsWith('/admin/purchase-orders')) return '採購單';
  if (pathname.startsWith('/admin/receiving-notes')) return '進貨驗收';
  if (pathname.startsWith('/admin/loyalty/settings')) return '系統設定';
  if (pathname.startsWith('/admin/loyalty/point-ledger')) return '點數存摺';
  if (pathname.startsWith('/admin/loyalty/members')) return '會員管理';
  if (pathname.startsWith('/admin/loyalty/coupons')) return '優惠券';
  if (pathname.startsWith('/admin/loyalty')) return '儀表板';
  return '後台';
}

function posTitle(pathname: string): string {
  if (pathname === '/pos' || pathname === '/pos/') return '收銀';
  if (pathname.startsWith('/pos/orders/')) return '訂單詳情';
  if (pathname.startsWith('/pos/orders')) return '訂單列表';
  if (pathname.startsWith('/pos/promos')) return '促銷';
  if (pathname.startsWith('/pos/reports')) return '報表';
  return 'POS';
}

export const AppShell: React.FC<{ mode: Mode }> = ({ mode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const title = useMemo(
    () => (mode === 'admin' ? adminTitle(location.pathname) : posTitle(location.pathname)),
    [mode, location.pathname],
  );
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
    <>
      <a href="#main-content" className="skip-link">
        跳至主內容
      </a>
      <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-canvas)' }}>
        <aside
          className="sticky top-0 flex h-screen w-[13rem] shrink-0 flex-col overflow-hidden"
          style={{ backgroundColor: 'var(--color-sidebar)' }}
        >
          <div className="shrink-0 border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                P
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">POS ERP</span>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {mode === 'admin' && (
              <>
                <NavLink to="/admin" className={navLinkClass} end>
                  總覽
                </NavLink>
                <NavLink to="/admin/reports" className={navLinkClass}>
                  金流報表
                </NavLink>
                <div className="my-2 border-t border-white/15" />
                <NavLink to="/admin/products" className={navLinkClass}>
                  商品主檔
                </NavLink>
                <NavLink to="/admin/categories" className={navLinkClass}>
                  分類
                </NavLink>
                <NavLink to="/admin/warehouses" className={navLinkClass}>
                  倉庫與門市
                </NavLink>
                <NavLink to="/admin/inventory" className={navLinkClass} end>
                  庫存餘額
                </NavLink>
                <NavLink to="/admin/inventory/adjust" className={navLinkClass}>
                  入庫／盤點
                </NavLink>
                <div className="my-2 border-t border-white/15" />
                <NavLink to="/admin/promotions" className={navLinkClass}>
                  促銷規則
                </NavLink>
                <div className="my-2 border-t border-white/15" />
                <NavLink to="/admin/customers" className={navLinkClass} end>
                  會員列表
                </NavLink>
                <NavLink to="/admin/customers/import" className={navLinkClass}>
                  客戶 CSV
                </NavLink>
                <NavLink to="/admin/loyalty" className={navLinkClass} end>
                  儀表板
                </NavLink>
                <NavLink to="/admin/loyalty/point-ledger" className={navLinkClass}>
                  點數存摺
                </NavLink>
                <NavLink to="/admin/loyalty/members" className={navLinkClass}>
                  會員管理
                </NavLink>
                <NavLink to="/admin/loyalty/coupons" className={navLinkClass}>
                  優惠券
                </NavLink>
                <NavLink to="/admin/loyalty/settings" className={navLinkClass}>
                  系統設定
                </NavLink>
                <div className="my-2 border-t border-white/15" />
                <NavLink to="/admin/suppliers" className={navLinkClass}>
                  供應商
                </NavLink>
                <NavLink to="/admin/purchase-orders" className={navLinkClass}>
                  採購單
                </NavLink>
                <NavLink to="/admin/receiving-notes" className={navLinkClass}>
                  進貨驗收
                </NavLink>
              </>
            )}
            {mode === 'pos' && (
              <>
                <NavLink to="/pos" className={navLinkClass} end>
                  收銀
                </NavLink>
                <NavLink to="/pos/orders" className={navLinkClass}>
                  訂單列表
                </NavLink>
                <NavLink to="/pos/promos" className={navLinkClass}>
                  促銷
                </NavLink>
                <NavLink to="/pos/reports" className={navLinkClass}>
                  報表
                </NavLink>
              </>
            )}
          </nav>
          <div className="shrink-0 border-t border-white/10 px-2 py-3">
            <button
              type="button"
              className="block w-full rounded-r-md border-l-[3px] border-transparent py-2 pl-3 pr-3 text-left text-sm font-medium text-[var(--color-sidebar-muted)] transition-colors hover:bg-white/10 hover:text-[var(--color-sidebar-text)]"
              onClick={() => navigate(mode === 'admin' ? '/pos' : '/admin')}
            >
              {mode === 'admin' ? '< 收銀' : '後台'}
            </button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-6"
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight" style={{ color: 'var(--color-content)' }}>
                {title}
              </h1>
              <span className="hidden shrink-0 text-sm tabular-nums sm:inline" style={{ color: 'var(--color-muted)' }}>
                {dateStr}
              </span>
            </div>
          </header>
          <main
            id="main-content"
            className="min-h-0 flex-1 overflow-auto p-6 text-[0.9375rem] leading-normal"
            style={{ backgroundColor: 'var(--color-canvas)' }}
            tabIndex={-1}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};
