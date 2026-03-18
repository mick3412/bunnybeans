import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

/** 與 Admin 側欄一致：選中 = 左線主色；未選 = 灰字 + hover；無圖示 */
const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-r-lg border-l-[3px] py-2.5 pl-3 pr-3 text-sm font-medium leading-snug transition-colors',
    isActive
      ? 'border-brand-primary bg-forge-sidebar-active text-white'
      : 'border-transparent text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200',
  ].join(' ');

function posHeaderTitle(pathname: string): string {
  if (pathname === '/pos' || pathname === '/pos/') return '門市收銀';
  if (pathname.startsWith('/pos/orders')) return '訂單查詢';
  if (pathname.startsWith('/pos/promos')) return '促銷';
  if (pathname.startsWith('/pos/reports')) return '報表';
  return '收銀';
}

export const PosLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const title = useMemo(() => posHeaderTitle(location.pathname), [location.pathname]);
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
    <div className="flex min-h-screen bg-forge-main">
      <a href="#main-content" className="skip-link">跳至主內容</a>
      <aside className="sticky top-0 flex h-screen max-h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-forge-sidebar">
        <div className="shrink-0 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
              P
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">POS</span>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5">
          <NavLink to="/pos" className={navClass} end title="收銀">收銀</NavLink>
          <NavLink to="/pos/orders" className={navClass} data-testid="e2e-nav-orders" title="訂單">訂單</NavLink>
          <NavLink to="/pos/promos" className={navClass} title="促銷">促銷</NavLink>
          <NavLink to="/pos/reports" className={navClass} title="報表">報表</NavLink>
        </nav>
        <div className="shrink-0 border-t border-white/10 px-2 py-4">
          <button
            type="button"
            data-testid="e2e-nav-admin-inventory"
            className="block w-full rounded-r-lg border-l-[3px] border-transparent py-2.5 pl-3 pr-3 text-left text-sm font-medium text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            onClick={() => navigate('/admin')}
            title="後台"
          >
            &lt; 後台
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-forge-main">
        <header className="flex h-14 shrink-0 items-center border-b border-[#e2e8f0] bg-forge-card px-6 shadow-sm">
          <h1 className="truncate text-xl font-semibold tracking-tight text-content">{title}</h1>
          <span className="ml-3 hidden shrink-0 text-sm text-muted sm:inline tabular-nums">{dateStr}</span>
        </header>
        <main id="main-content" className="min-h-0 flex-1 overflow-auto bg-forge-main p-6 text-[0.9375rem] leading-normal" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
