import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminToastProvider } from './AdminToastContext';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useAdminTodoItems } from '../../shared/hooks/useAdminTodoItems';
import { useTodoDismiss } from '../../shared/hooks/useTodoDismiss';
import { getMerchantCurrent, listMerchants, type MerchantCurrentDto, type MerchantDto, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

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
  if (pathname.startsWith('/admin/inventory/expiring')) return '即期庫存';
  if (pathname.startsWith('/admin/inventory')) return '庫存餘額';
  if (pathname.startsWith('/admin/products')) return '商品主檔';
  if (pathname.startsWith('/admin/categories')) return '類別管理';
  if (pathname.startsWith('/admin/warehouses')) return '倉庫/門市';
  if (pathname.startsWith('/admin/reports')) return '金流報表';
  if (pathname.startsWith('/admin/balances')) return '應收應付餘額';
  if (pathname.startsWith('/admin/finance/periods')) return '關帳區間';
  if (pathname.startsWith('/admin/finance/audit')) return '稽核紀錄';
  if (pathname.startsWith('/admin/finance/snapshots')) return '金流快照';
  if (pathname.startsWith('/admin/ops/jobs')) return 'Job 監控';
  if (pathname.startsWith('/admin/ops/report-clicks')) return '穿透點擊審計';
  if (pathname.startsWith('/admin/marketing/rules')) return '行銷發券規則';
  if (pathname.startsWith('/admin/segments/export')) return '分群匯出';
  if (pathname.startsWith('/admin/segments')) return '分群管理';
  if (pathname.startsWith('/admin/dispatch-rules')) return '發券規則';
  if (pathname.includes('/admin/promotions/new')) return '新增促銷';
  if (pathname.match(/\/admin\/promotions\/[^/]+/)) return '編輯促銷';
  if (pathname.startsWith('/admin/promotions')) return '促銷規則';
  if (pathname.startsWith('/admin/customers/import')) return '客戶 CSV';
  if (pathname.startsWith('/admin/customers')) return '會員列表';
  if (pathname.startsWith('/admin/suppliers')) return '供應商管理';
  if (pathname.startsWith('/admin/purchase-orders')) return '採購單管理';
  if (pathname.startsWith('/admin/replenishment')) return '補貨建議';
  if (pathname.startsWith('/admin/receiving-notes')) return '進貨驗收';
  if (pathname.startsWith('/admin/loyalty/settings')) return '集點設定';
  if (pathname.startsWith('/admin/loyalty/point-ledger')) return '點數存摺';
  // /admin/loyalty/members 已在路由層 redirect 到 /admin/customers
  if (pathname.startsWith('/admin/loyalty/members')) return '會員列表';
  if (pathname.startsWith('/admin/loyalty/coupons')) return '優惠券';
  if (pathname.startsWith('/admin/loyalty/reports')) return '活動報表';
  if (pathname.startsWith('/admin/loyalty')) return '儀表板';
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
          <div className="shrink-0 border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
                P
              </span>
              <span className="text-sm font-semibold tracking-tight text-white">POS ERP</span>
            </div>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5" aria-label="導覽">
            {/* 營運管理 */}
            <div className="mb-1 mt-0.5 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">營運管理</div>
            <NavLink to="/admin" className={navClass} end>總覽</NavLink>
            <NavLink to="/admin/products" className={navClass}>商品主檔</NavLink>
            <NavLink to="/admin/categories" className={navClass}>類別管理</NavLink>
            <NavLink to="/admin/warehouses" className={navClass}>倉庫/門市</NavLink>
            <NavLink to="/admin/inventory" className={navClass} end>庫存餘額</NavLink>
            <NavLink to="/admin/inventory/expiring" className={navClass}>即期庫存</NavLink>
            <NavLink to="/admin/inventory/adjust" className={navClass}>入庫／盤點</NavLink>
            <NavLink to="/admin/suppliers" className={navClass}>供應商</NavLink>
            <NavLink to="/admin/purchase-orders" className={navClass}>採購單</NavLink>
            <NavLink to="/admin/receiving-notes" className={navClass}>進貨驗收</NavLink>
            <NavLink to="/admin/replenishment" className={navClass}>補貨建議</NavLink>
            <NavLink to="/admin/balances" className={navClass}>應收應付餘額</NavLink>
            <NavLink to="/admin/finance/periods" className={navClass}>關帳區間</NavLink>
            <NavLink to="/admin/finance/audit" className={navClass}>稽核紀錄</NavLink>
            <NavLink to="/admin/finance/snapshots" className={navClass}>金流快照</NavLink>
            <NavLink to="/admin/ops/jobs" className={navClass}>Job 監控</NavLink>
            <NavLink to="/admin/ops/report-clicks" className={navClass}>穿透點擊審計</NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 報表中心 */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">報表中心</div>
            <NavLink to="/pos/reports" className={navClass}>銷售報表</NavLink>
            <NavLink to="/admin/reports" className={navClass}>金流報表</NavLink>
            <NavLink to="/admin/inventory" className={navClass} end>庫存報表</NavLink>
            <NavLink to="/admin/loyalty/reports" className={navClass}>會員報表</NavLink>

            <div className="my-2 border-t border-white/25" aria-hidden />

            {/* 會員與行銷 */}
            <div className="mb-1 shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">會員與行銷</div>
            <NavLink to="/admin/loyalty" className={navClass} end>儀表板</NavLink>
            <NavLink to="/admin/loyalty/point-ledger" className={navClass}>點數存摺</NavLink>
            <NavLink to="/admin/customers" className={navClass}>會員管理</NavLink>
            <NavLink to="/admin/loyalty/coupons" className={navClass}>優惠券</NavLink>
            <NavLink to="/admin/loyalty/reports" className={navClass}>活動報表</NavLink>
            <NavLink to="/admin/loyalty/settings" className={navClass}>集點設定</NavLink>
            <NavLink to="/admin/segments" className={navClass}>分群管理</NavLink>
            <NavLink to="/admin/dispatch-rules" className={navClass}>發券規則</NavLink>
            <NavLink to="/admin/crm/jobs" className={navClass}>行銷工作台（Jobs）</NavLink>
            <NavLink to="/admin/marketing/rules" className={navClass}>行銷規則（常駐）</NavLink>
            <NavLink to="/admin/promotions" className={navClass}>促銷規則</NavLink>
          </nav>
          <div className="shrink-0 border-t border-white/10 px-2 py-4">
            <button
              type="button"
              className="block w-full rounded-r-lg border-l-[3px] border-transparent py-2.5 pl-3 pr-3 text-left text-sm font-medium text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              onClick={() => navigate('/pos')}
            >
              &lt; 收銀
            </button>
          </div>
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
                                title={it.unavailable ? '待後端提供資料' : '前往處理'}
                              >
                                前往
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-muted">提示：通知/待辦目前為前端彙整，且已處理/稍後提醒只記錄在本機。</div>
                </div>
              )}
            </div>
          </header>
          <main id="main-content" className="min-h-0 flex-1 overflow-auto bg-forge-main p-6 text-[0.9375rem] leading-normal" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </AdminToastProvider>
  );
};
