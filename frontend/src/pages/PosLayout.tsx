import React, { Suspense, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PosStoreSessionProvider, usePosStoreSession } from '../modules/pos/PosStoreSessionContext';
import { PosSessionBar } from './pos/PosSessionBar';

/** 與 Admin 側欄一致：選中 = 左線主色；未選 = 同色字體 + hover */
const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-r-lg border-l-[3px] py-2.5 pl-3 pr-3 text-sm font-medium leading-snug transition-colors',
    isActive
      ? 'border-brand-primary bg-forge-sidebar-active text-white'
      : 'border-transparent text-white hover:bg-white/[0.06]',
  ].join(' ');

function posHeaderTitle(pathname: string, search: string): string {
  const tab = new URLSearchParams(search).get('tab');
  if (pathname === '/pos' || pathname === '/pos/') return '門市收銀';
  if (pathname.startsWith('/pos/orders')) return tab === 'after-sales' ? '退換貨明細' : '訂單總覽';
  if (pathname.startsWith('/pos/after-sales')) return '退換貨明細';
  if (pathname.startsWith('/pos/promos')) return '促銷';
  if (pathname.startsWith('/pos/reports')) return '報表';
  return '收銀';
}

const isPosIndex = (pathname: string) => pathname === '/pos' || pathname === '/pos/';

const PosStoreSessionHeaderBlock: React.FC = () => {
  const { apiStoreId, setApiStoreId, apiStores, apiLoadError, storeName } = usePosStoreSession();
  const storeId = apiStoreId ?? '';

  if (apiStores.length === 0 && !apiLoadError) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {apiStores.length > 0 ? (
        <>
          <label htmlFor="pos-store-select" className="text-xs font-medium text-muted">
            門市
          </label>
          <select
            id="pos-store-select"
            value={apiStoreId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setApiStoreId(v || null);
            }}
            className="min-w-[10rem] rounded-lg border border-brand-surface bg-white px-2 py-1.5 text-xs text-content focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            data-testid="e2e-pos-store-select"
          >
            <option value="">— 請選擇門市 —</option>
            {apiStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {!apiStoreId && (
            <span className="text-xs text-brand-danger">請先選擇門市（掛單／取單／結帳皆需門市）</span>
          )}
        </>
      ) : (
        apiLoadError && <span className="text-sm text-brand-warning">{apiLoadError}</span>
      )}
      {storeId ? <PosSessionBar storeId={storeId} storeName={storeName} inline /> : null}
    </div>
  );
};

const PosLayoutInner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const title = useMemo(() => posHeaderTitle(location.pathname, location.search), [location.pathname, location.search]);
  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );
  const showStoreSession = useMemo(() => isPosIndex(location.pathname), [location.pathname]);

  return (
    <div className="flex min-h-screen bg-forge-main">
      <a href="#main-content" className="skip-link">跳至主內容</a>
      <aside className="sticky top-0 flex h-screen max-h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-forge-sidebar">
        <div className="shrink-0 border-b border-white/10 px-2 py-3">
          <div className="flex rounded-lg bg-white/5 p-1">
            <span className="flex flex-1 items-center justify-center rounded-md bg-forge-sidebar-active py-2 text-sm font-medium text-white">POS</span>
            <button
              type="button"
              data-testid="e2e-nav-admin-inventory"
              className="flex flex-1 items-center justify-center rounded-md py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
              onClick={() => navigate('/admin')}
              title="後台"
            >
              後台
            </button>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5">
          <NavLink to="/pos" className={navClass} end title="收銀">收銀</NavLink>
          <NavLink to="/pos/orders" className={navClass} data-testid="e2e-nav-orders" title="訂單">訂單</NavLink>
          <NavLink to="/pos/promos" className={navClass} title="促銷">促銷</NavLink>
          <NavLink to="/pos/reports" className={navClass} title="報表">報表</NavLink>
        </nav>
        <div className="shrink-0 border-t border-white/10 px-2 py-2" aria-hidden="true" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-forge-main">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-brand-surface bg-forge-card px-6 shadow-sm">
          <div className="flex min-w-0 items-center">
            <h1 className="truncate text-xl font-semibold tracking-tight text-content">{title}</h1>
            <span className="ml-3 hidden shrink-0 text-sm text-muted sm:inline tabular-nums">{dateStr}</span>
          </div>
          {showStoreSession && (
            <div className="shrink-0">
              <PosStoreSessionHeaderBlock />
            </div>
          )}
        </header>
        <main id="main-content" className="min-h-0 flex-1 overflow-auto bg-forge-main p-6 text-[0.9375rem] leading-normal" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted" role="status">
                載入中…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export const PosLayout: React.FC = () => (
  <PosStoreSessionProvider>
    <PosLayoutInner />
  </PosStoreSessionProvider>
);
