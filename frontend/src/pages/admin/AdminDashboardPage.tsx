import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboardSummary,
  getCategoriesEnriched,
  getExpiringInventory,
  getLoyaltyReportMembers,
  type ApiError,
  type DashboardSummaryDto,
} from '../../modules/admin/adminApi';
import { listPurchaseOrdersReceivable } from '../../modules/admin/purchaseApi';
import { getPosReportsSummary, getPosDaily } from '../../modules/pos/posOrdersApi';
import { getErrorMessage, showAdminApiErrorToast } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { KpiCard } from '../../shared/components/KpiCard';
import { Alert } from '../../shared/components/Alert';
import { MiniLineChart } from '../../shared/components/MiniLineChart';
import { useAdminTodoItems } from '../../shared/hooks/useAdminTodoItems';
import { useTodoDismiss } from '../../shared/hooks/useTodoDismiss';

function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

function formatMoney(s: string | number): string {
  const n = typeof s === 'string' ? Number(s) : s;
  if (Number.isNaN(n)) return String(s);
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(n);
}

const cardLinkClass =
  'block rounded-lg border border-brand-surface bg-forge-card p-3 shadow-sm transition-colors hover:border-brand-primary/50 hover:shadow-md cursor-pointer';

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const merchantId = useDefaultMerchantId();
  const { items: todoItems } = useAdminTodoItems(merchantId);
  const { isHidden, dismiss, snooze } = useTodoDismiss();
  const [data, setData] = useState<DashboardSummaryDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enrichedHint, setEnrichedHint] = useState<string | null>(null);
  const [todayRevenue, setTodayRevenue] = useState<string | null>(null);
  const [pendingPOCount, setPendingPOCount] = useState<number | null>(null);
  const [expiringCount, setExpiringCount] = useState<number | null>(null);
  const [newMembersCount, setNewMembersCount] = useState<number | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getDashboardSummary();
      if (cancelled) return;
      if ('statusCode' in res) {
        const msg = getErrorMessage(res as ApiError);
        setErr(msg);
        showAdminApiErrorToast(showToast, res as ApiError);
        setData(null);
        return;
      }
      setErr(null);
      setData(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getCategoriesEnriched();
      if (cancelled) return;
      if (Array.isArray(res) && res.length) {
        const withCount = res.filter((c) => typeof c.productCount === 'number');
        if (withCount.length) {
          setEnrichedHint(`分類 ${res.length} 筆（${withCount.length} 筆含商品數）`);
        } else {
          setEnrichedHint(`分類 ${res.length} 筆`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getPosReportsSummary({ preset: 'today' });
      if (cancelled) return;
      if (r && typeof r === 'object' && 'totalRevenue' in r) {
        setTodayRevenue(r.totalRevenue as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    let cancelled = false;
    (async () => {
      const r = await listPurchaseOrdersReceivable(merchantId);
      if (cancelled) return;
      setPendingPOCount(r?.data?.length ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getExpiringInventory({ daysAhead: 30, pageSize: 1 });
      if (cancelled) return;
      if (r && typeof r === 'object' && 'total' in r) setExpiringCount(r.total);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!merchantId) return;
    let cancelled = false;
    (async () => {
      const r = await getLoyaltyReportMembers(merchantId, { preset: 'last30d' });
      if (cancelled) return;
      if (r && typeof r === 'object' && 'newMembersCount' in r) {
        setNewMembersCount(r.newMembersCount);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const summary = await getPosReportsSummary({ preset: 'last7d' });
      if (cancelled) return;
      if (!summary || 'statusCode' in summary || !summary.period) {
        setDailyRevenue([]);
        return;
      }
      const d = await getPosDaily({ from: summary.period.from, to: summary.period.to });
      if (cancelled) return;
      if (Array.isArray(d)) {
        setDailyRevenue(d.map((r) => ({ date: r.date, revenue: r.revenue })));
      } else {
        setDailyRevenue([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 待辦中心與頂欄鈴鐺共用 useAdminTodoItems + localStorage 行為（已處理 / 稍後提醒）

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="border-b border-brand-surface pb-2">
          <h2 className="text-lg font-semibold text-content">營運總覽</h2>
          <p className="mt-1 text-sm text-muted">即時庫存與銷售指標</p>
        </div>
        {enrichedHint && (
          <span className="rounded-full border border-brand-surface bg-white px-3 py-1 text-xs text-muted shadow-sm">
            {enrichedHint}
          </span>
        )}
      </div>

      {err && (
        <div className="mb-6">
          <Alert variant="error" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </Alert>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" data-testid="e2e-admin-dashboard">
        <Link to="/pos/reports" className={`kpi-card-accent-blue ${cardLinkClass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">今日營收</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {todayRevenue != null ? formatMoney(todayRevenue) : '—'}
          </p>
        </Link>
        <Link to="/pos/orders" className={`kpi-card-accent-amber ${cardLinkClass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">待處理訂單</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {data ? formatInt(data.ordersTodayCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/replenishment" className={`kpi-card-accent-green ${cardLinkClass}`}>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">低庫存</p>
            {data && data.skuLowStockCount > 0 && (
              <span className="h-1 w-1 rounded-full bg-amber-500" aria-hidden />
            )}
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {data ? formatInt(data.skuLowStockCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/inventory" className={`kpi-card-accent-slate ${cardLinkClass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">即將到期</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {expiringCount != null ? formatInt(expiringCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/receiving-notes" className={cardLinkClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">待驗收</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {pendingPOCount != null ? formatInt(pendingPOCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/customers" className={cardLinkClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">會員增長</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-content">
            {newMembersCount != null ? formatInt(newMembersCount) : '—'}
          </p>
        </Link>
      </div>

      {dailyRevenue.length > 0 && (
        <div className="mt-6 rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-muted">近期營收趨勢（近 7 日）</h3>
          <MiniLineChart
            items={dailyRevenue.map((r) => ({ label: r.date, value: r.revenue }))}
            height={80}
            formatValue={(n) => formatMoney(n)}
          />
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/products" className={`kpi-card-accent-blue ${cardLinkClass}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">商品主檔</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-content">
            {data ? formatInt(data.productCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/replenishment" className={`kpi-card-accent-green ${cardLinkClass}`}>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">缺貨 SKU</p>
            {data && data.skuOutOfStockCount > 0 && (
              <span className="h-1 w-1 rounded-full bg-red-500" aria-hidden />
            )}
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-content">
            {data ? formatInt(data.skuOutOfStockCount) : '—'}
          </p>
        </Link>
        <Link to="/admin/inventory" className={cardLinkClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">庫存總件數</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-content">
            {data ? formatInt(data.totalOnHandUnits) : '—'}
          </p>
        </Link>
        <Link to="/admin/inventory" className={cardLinkClass}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">庫存參考金額</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-content">
            {data ? formatMoney(data.inventoryValueApprox) : '—'}
          </p>
        </Link>
      </div>

      {/* 待辦中心：置於頁面最下方 */}
      <div className="mt-6 rounded-lg border border-brand-surface bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-muted">待辦中心</h3>
          <Link
            to="/admin/purchase-orders/quick-receiving"
            className="rounded border border-brand-surface bg-white px-2 py-1 text-[11px] font-medium text-content hover:border-brand-primary/30"
          >
            快速進貨
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {todoItems
            .filter((it) => !isHidden(it.key))
            .map((it) => (
              <Link
                key={it.key}
                to={it.to}
                aria-disabled={it.unavailable ? true : undefined}
                className={[
                  'flex items-center justify-between gap-2 rounded border border-brand-surface bg-table-head px-2 py-1.5 transition hover:border-brand-primary/40',
                  it.unavailable ? 'opacity-70' : '',
                ].join(' ')}
                onClick={(e) => {
                  if (!it.unavailable) return;
                  e.preventDefault();
                  showToast('暫不可用', 'err');
                }}
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-content truncate">{it.title}</div>
                  <div className="text-[10px] tabular-nums text-muted">{it.countText}</div>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    className="rounded border border-brand-surface bg-white px-1.5 py-0.5 text-[10px] text-muted hover:border-brand-primary/30"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dismiss(it.key);
                      showToast('已標記處理', 'ok');
                    }}
                  >
                    已處理
                  </button>
                  <button
                    type="button"
                    className="rounded border border-brand-surface bg-white px-1.5 py-0.5 text-[10px] text-muted hover:border-brand-primary/30"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      snooze(it.key, 24 * 60 * 60 * 1000);
                      showToast('已稍後提醒（24 小時）', 'ok');
                    }}
                  >
                    稍後
                  </button>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
};
