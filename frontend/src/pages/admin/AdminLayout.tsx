import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminToastProvider } from './AdminToastContext';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminTodoItems } from '../../shared/hooks/useAdminTodoItems';
import { useTodoDismiss } from '../../shared/hooks/useTodoDismiss';
import { getMerchantCurrent, listMerchants, type MerchantCurrentDto, type MerchantDto, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

/** Forge：選中 = 左線主色；未選 = 同色字體 + hover */
const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-r-lg border-l-[3px] py-2.5 pl-3 pr-3 text-sm font-medium leading-snug transition-colors',
    isActive
      ? 'border-brand-primary bg-forge-sidebar-active text-white'
      : 'border-transparent text-white hover:bg-white/[0.06]',
  ].join(' ');

function headerTitle(
  pathname: string,
  hubs: {
    financeTab: string | null;
    inventoryTab: string | null;
    productTab: string | null;
    opsTab: string | null;
    memberTab: string | null;
    marketingTab: string | null;
  },
): string {
  const { financeTab, inventoryTab, productTab, opsTab, memberTab } = hubs;

  if (pathname === '/admin' || pathname === '/admin/') {
    if (opsTab === 'jobs') return 'Job 監控';
    if (opsTab === 'clicks') return '穿透點擊審計';
    return '營運';
  }
  if (pathname.startsWith('/admin/performance')) return '業績';
  if (pathname.startsWith('/admin/inventory/adjust')) return '入庫';
  if (pathname.startsWith('/admin/inventory/expiring')) return '即期庫存';
  if (pathname.startsWith('/admin/inventory')) {
    if (inventoryTab === 'expiring') return '即期庫存';
    if (inventoryTab === 'slowMoving') return '滯銷品';
    if (inventoryTab === 'adjust') return '入庫';
    if (inventoryTab === 'warehouses') return '倉庫/門市';
    return '庫存報表';
  }
  if (pathname.startsWith('/admin/products')) {
    if (productTab === 'categories') return '類別管理';
    return '商品總覽';
  }
  if (pathname.startsWith('/admin/categories')) return '類別管理';
  if (pathname.startsWith('/admin/discount-tags')) return '折扣標籤';
  if (pathname.startsWith('/admin/warehouses')) return '倉庫/門市';
  if (pathname.startsWith('/admin/pos/sessions')) return '收銀班次';
  if (pathname.startsWith('/admin/reports') || pathname.startsWith('/admin/balances') || pathname.startsWith('/admin/finance/')) {
    if (financeTab === 'balances') return '應收應付';
    if (financeTab === 'periods') return '關帳區間';
    if (financeTab === 'audit') return '稽核紀錄';
    if (financeTab === 'snapshots') return '金流快照';
    return '金流報表';
  }
  if (pathname.startsWith('/admin/ops/jobs')) {
    if (opsTab === 'overview') return '總覽';
    if (opsTab === 'clicks') return '穿透點擊審計';
    return 'Job 監控';
  }
  if (pathname.startsWith('/admin/ops/report-clicks')) {
    if (opsTab === 'overview') return '總覽';
    if (opsTab === 'jobs') return 'Job 監控';
    return '穿透點擊審計';
  }
  if (pathname.startsWith('/admin/marketing/rules/new')) return '新增行銷規則';
  if (pathname.match(/\/admin\/marketing\/rules\/[^/]+/)) return '編輯行銷規則';
  if (pathname.startsWith('/admin/marketing/rules')) return '行銷規則（常駐）';
  if (pathname.startsWith('/admin/crm/jobs')) return '行銷工作台（Jobs）';
  if (pathname.startsWith('/admin/segments/export')) return '分群匯出';
  if (pathname.includes('/admin/promotions/new')) return '新增促銷';
  if (pathname.match(/\/admin\/promotions\/[^/]+/)) return '編輯促銷';
  if (pathname.startsWith('/admin/promotions')) {
    if (marketingTab === 'jobs') return '行銷工作台（Jobs）';
    if (marketingTab === 'marketingRules') return '行銷規則（常駐）';
    if (marketingTab === 'coupons') return '優惠券';
    if (marketingTab === 'segments') return '分群管理';
    if (marketingTab === 'dispatchRules') return '發券規則';
    return '促銷規則';
  }
  if (pathname.startsWith('/admin/loyalty/coupons')) return '優惠券';
  if (pathname.startsWith('/admin/segments')) return '分群管理';
  if (pathname.startsWith('/admin/dispatch-rules')) return '發券規則';
  if (pathname.startsWith('/admin/customers/import')) return '客戶 CSV 匯入';
  // 會員中心/會員管理：依 member.hub.tab 決定
  if (pathname.startsWith('/admin/suppliers')) return '供應商管理';
  if (pathname.startsWith('/admin/purchase-orders')) return '採購單管理';
  if (pathname.startsWith('/admin/replenishment')) return '補貨建議';
  if (pathname.startsWith('/admin/receiving-notes')) return '進貨驗收';
  // /admin/loyalty/members 已在路由層 redirect 到 /admin/customers
  if (pathname.startsWith('/admin/loyalty/members')) return '會員管理';
  if (pathname.startsWith('/admin/loyalty') || pathname.startsWith('/admin/customers')) {
    const fromTab =
      memberTab === 'members'
        ? '會員管理'
        : memberTab === 'pointLedger'
          ? '點數存摺'
          : memberTab === 'reports'
            ? '活動報表'
            : memberTab === 'settings'
              ? '集點設定'
              : memberTab === 'tierRules'
                ? '會員等級規則'
                : memberTab === 'dashboard'
                  ? '儀表板'
                  : null;

    if (fromTab) return fromTab;

    // 當 member.hub.tab 尚未寫入 URL（例如剛進頁）時，以 pathname 做兜底
    if (pathname.startsWith('/admin/loyalty/settings')) return '集點設定';
    if (pathname.startsWith('/admin/loyalty/point-ledger')) return '點數存摺';
    if (pathname.startsWith('/admin/loyalty/reports')) return '活動報表';
    if (pathname.startsWith('/admin/loyalty/tier-rules')) return '會員等級規則';
    if (pathname.startsWith('/admin/loyalty/members')) return '會員管理';
    if (pathname.startsWith('/admin/customers')) return '會員管理';
    return '儀表板';
  }
  if (pathname.startsWith('/admin/merchants')) return '商家主檔';
  return '後台';
}

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const merchantId = useDefaultMerchantId();
  const { items: todoItems } = useAdminTodoItems(merchantId);
  const { isHidden, dismiss, snooze } = useTodoDismiss();
  const hubs = useMemo(
    () => ({
      financeTab: searchParams.get('finance.hub.tab'),
      inventoryTab: searchParams.get('inventory.query.hub.tab'),
      productTab: searchParams.get('product.hub.tab'),
      opsTab: searchParams.get('ops.monitoring.hub.tab'),
      memberTab: searchParams.get('member.hub.tab'),
      marketingTab: searchParams.get('marketing.hub.tab'),
    }),
    [searchParams],
  );
  const title = useMemo(() => headerTitle(location.pathname, hubs), [location.pathname, hubs]);
  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const visibleTodos = useMemo(() => todoItems.filter((it) => !isHidden(it.key)), [todoItems, isHidden]);
  const unreadCount = visibleTodos.length;
  const [bellOpen, setBellOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [merchantCurrent, setMerchantCurrent] = useState<MerchantCurrentDto | null>(null);
  const [merchantErr, setMerchantErr] = useState<string | null>(null);
  const [merchantList, setMerchantList] = useState<MerchantDto[]>([]);

  const merchantIdFromUrl = (searchParams.get('merchantId') ?? '').trim();
  const selectedMerchantId = merchantIdFromUrl || merchantCurrent?.id || merchantId;

  const selectedMerchantLabel = useMemo(() => {
    const m = merchantList.find((x) => x.id === selectedMerchantId);
    if (m) return m.name ?? m.code ?? m.id;
    if (merchantCurrent && merchantCurrent.id === selectedMerchantId) return merchantCurrent.name ?? merchantCurrent.code ?? merchantCurrent.id;
    return selectedMerchantId || '（未選）';
  }, [merchantCurrent, merchantList, selectedMerchantId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!bellOpen) return;
      const el = popRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setBellOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [bellOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = await getMerchantCurrent();
      if (cancelled) return;
      if (out && typeof out === 'object' && 'statusCode' in out) {
        setMerchantCurrent(null);
        setMerchantErr(getErrorMessage(out as ApiError));
        return;
      }
      setMerchantErr(null);
      setMerchantCurrent(out as MerchantCurrentDto);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = await listMerchants();
      if (cancelled) return;
      if (Array.isArray(out)) {
        setMerchantList(out);
      } else {
        setMerchantList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMerchantId) return;
    if (merchantIdFromUrl) return;
    const next = new URLSearchParams(searchParams);
    next.set('merchantId', selectedMerchantId);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMerchantId]);

  return (
    <AdminToastProvider>
      <a href="#main-content" className="skip-link">跳至主內容</a>
      <div className="flex min-h-screen bg-forge-main">
        <aside className="sticky top-0 flex h-screen max-h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-forge-sidebar">
          <div className="shrink-0 border-b border-white/10 px-2 py-3">
            <div className="flex rounded-lg bg-white/5 p-1">
              <button
                type="button"
                className="flex flex-1 items-center justify-center rounded-md py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                onClick={() => navigate('/pos')}
                title="POS"
              >
                POS
              </button>
              <span className="flex flex-1 items-center justify-center rounded-md bg-forge-sidebar-active py-2 text-sm font-medium text-white">後台</span>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5" aria-label="導覽">
            {/* 第一層：營運 / 監控（不可點） */}
            <div className="mb-1 mt-0.5 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">營運 / 監控</div>
            {/* 第二層：主入口（可點） */}
            <NavLink to="/admin" className={navClass} end>
              營運
            </NavLink>
            <NavLink to="/admin/performance" className={navClass}>
              業績
            </NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 第一層：商品/庫存（不可點） */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">商品/庫存</div>
            {/* 第二層：主入口（可點） */}
            <NavLink to="/admin/products" className={navClass}>
              商品總覽
            </NavLink>
            <NavLink to="/admin/discount-tags" className={navClass}>
              折扣標籤
            </NavLink>
            <NavLink to="/admin/inventory" className={navClass}>
              庫存總覽
            </NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 第一層：採購/入庫（不可點） */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">採購/入庫</div>
            {/* 第二層：主入口（可點） */}
            <NavLink to="/admin/procurement" className={navClass}>
              採購總覽
            </NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 第一層：財務（不可點） */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">財務</div>
            {/* 第二層：主入口（可點） */}
            <NavLink to="/admin/reports" className={navClass}>
              金流報表
            </NavLink>
            <NavLink to="/admin/balances" className={navClass}>
              應收應付
            </NavLink>
            <NavLink to="/admin/pos/sessions" className={navClass}>
              收銀班次
            </NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 第一層：會員/行銷（不可點） */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">會員/行銷</div>
            {/* 第二層：主入口（可點） */}
            <NavLink to="/admin/loyalty" className={navClass} end>
              儀表板
            </NavLink>
            <NavLink to="/admin/customers" className={navClass}>
              會員管理
            </NavLink>
            <NavLink to="/admin/promotions" className={navClass}>
              促銷規則
            </NavLink>
          </nav>
          <div className="shrink-0 border-t border-white/10 px-2 py-2" aria-hidden="true" />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-forge-main">
          <header className="flex h-14 shrink-0 items-center border-b border-brand-surface bg-forge-card px-6 shadow-sm">
            <h1 className="truncate text-xl font-semibold tracking-tight text-content">{title}</h1>
            <span className="ml-3 hidden shrink-0 text-sm text-muted sm:inline tabular-nums">{dateStr}</span>
            <div className="ml-auto flex items-center gap-2" ref={popRef}>
              <div className="hidden items-center gap-2 rounded-xl border border-brand-surface bg-white px-3 py-2 text-xs shadow-sm sm:flex">
                <span className="font-semibold text-content">商家</span>
                <select
                  className="max-w-[240px] rounded-lg border border-brand-surface bg-white px-2 py-1 text-xs text-content focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={selectedMerchantId}
                  disabled={!merchantList.length}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const next = new URLSearchParams(searchParams);
                    if (nextId) next.set('merchantId', nextId);
                    else next.delete('merchantId');
                    setSearchParams(next, { replace: true });
                  }}
                  aria-label="選擇商家"
                >
                  {!merchantList.length ? (
                    <option value={selectedMerchantId}>
                      {merchantErr ? '無法取得商家列表' : '載入中…'}
                    </option>
                  ) : null}
                  {merchantList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.code ?? m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-[10px] text-muted" title={selectedMerchantId}>
                  {selectedMerchantId ? selectedMerchantId.slice(0, 8) + '…' : '—'}
                </span>
                <span className="sr-only">目前：{selectedMerchantLabel}</span>
              </div>
              <button
                type="button"
                className="relative rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm text-content hover:border-brand-primary/40"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="通知中心"
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="text-muted">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M9 17a3 3 0 0 0 6 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="hidden sm:inline text-muted">通知</span>
                </span>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-6 top-14 z-[120] w-[min(520px,calc(100vw-32px))] rounded-xl border border-brand-surface bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-content">通知中心</div>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-muted hover:bg-brand-canvas"
                      onClick={() => setBellOpen(false)}
                    >
                      關閉
                    </button>
                  </div>
                  {visibleTodos.length === 0 ? (
                    <div className="rounded-lg border border-brand-surface bg-table-head px-3 py-4 text-center text-sm text-muted">
                      目前沒有待辦
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[52vh] space-y-2 overflow-auto pr-1">
                        {visibleTodos.map((it) => (
                          <div key={it.key} className="rounded-lg border border-brand-surface bg-table-head px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-content">{it.title}</div>
                                <div className="mt-1 text-sm tabular-nums text-muted">{it.countText}</div>
                                {it.metaText && <div className="mt-0.5 text-[11px] text-muted">{it.metaText}</div>}
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <button
                                  type="button"
                                  className="rounded border border-brand-surface bg-white px-2 py-1 text-[11px] text-muted hover:border-brand-primary/30"
                                  onClick={() => dismiss(it.key)}
                                >
                                  已處理
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-brand-surface bg-white px-2 py-1 text-[11px] text-muted hover:border-brand-primary/30"
                                  onClick={() => snooze(it.key, 24 * 60 * 60 * 1000)}
                                >
                                  稍後
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-brand-surface bg-white px-2 py-1 text-[11px] font-medium text-sky-700 hover:border-brand-primary/30"
                                  onClick={() => {
                                    setBellOpen(false);
                                    navigate(it.to);
                                  }}
                                  disabled={it.unavailable}
                                  title={it.unavailable ? '暫不可用' : '前往處理'}
                                >
                                  前往
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-muted" aria-hidden="true" />
                    </>
                  )}
                </div>
              )}
            </div>
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
    </AdminToastProvider>
  );
};
