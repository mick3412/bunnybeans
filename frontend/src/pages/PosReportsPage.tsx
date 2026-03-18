import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getPosReportsSummary,
  getPosTopItems,
  getPosDaily,
  listOrders,
  type ApiError,
  type PosReportsSummaryDto,
  type PosReportsPreset,
  type PosTopItemRow,
  type PosDailyRow,
  type PosOrderListResponse,
} from '../modules/pos/posOrdersApi';
import { getErrorMessage } from '../shared/errors/errorMessages';
import { MiniBarChart } from '../shared/components/MiniBarChart';
import { MiniLineChart } from '../shared/components/MiniLineChart';

function money(s: string) {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);
}

const cardBase = 'rounded-xl border border-brand-surface bg-white p-4 shadow-sm';

export const PosReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetFromQuery = searchParams.get('preset') as PosReportsPreset | null;
  const [data, setData] = useState<PosReportsSummaryDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [preset, setPreset] = useState<PosReportsPreset>(presetFromQuery ?? 'today');
  const [orders, setOrders] = useState<PosOrderListResponse | null>(null);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);
  const [topItems, setTopItems] = useState<PosTopItemRow[]>([]);
  const [topItemsErr, setTopItemsErr] = useState<string | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState<boolean>(false);
  const [daily, setDaily] = useState<PosDailyRow[]>([]);
  const [dailyErr, setDailyErr] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState<boolean>(false);

  const periodLabel = useMemo(() => {
    if (!data?.period) return '今日';
    const p = data.period;
    if (p.preset && p.preset !== 'today') {
      const map: Record<string, string> = {
        today: '今日',
        last7d: '近 7 日',
        last30d: '近 30 日',
        currentMonth: '本月',
        last60d: '近 60 日',
        lastHalfYear: '近半年',
      };
      return `${map[p.preset] ?? p.preset}（${p.from}～${p.to}）`;
    }
    return `${p.from}～${p.to}`;
  }, [data]);

  useEffect(() => {
    const p = presetFromQuery ?? 'today';
    if (p !== preset) {
      setPreset(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetFromQuery]);

  useEffect(() => {
    let c = false;
    (async () => {
      setSummaryLoading(true);
      const r = await getPosReportsSummary({ preset });
      if (c) return;
      if ('statusCode' in r) {
        setErr(getErrorMessage(r as ApiError));
        setData(null);
      } else {
        setErr(null);
        setData(r);
      }
      setSummaryLoading(false);
    })();
    return () => {
      c = true;
    };
  }, [preset]);

  useEffect(() => {
    if (!data?.period) return;
    const { from, to } = data.period;
    let cancelled = false;
    (async () => {
      setTopItemsLoading(true);
      setDailyLoading(true);
      const ordersRes = await listOrders({ from, to, page: 1, pageSize: 20 });
      if (cancelled) return;
      if ('statusCode' in ordersRes) {
        setOrdersErr(getErrorMessage(ordersRes as ApiError));
        setOrders(null);
      } else {
        setOrdersErr(null);
        setOrders(ordersRes);
      }
      const top = await getPosTopItems({ from, to, limit: 10, sortBy: 'revenue' });
      if (!cancelled) {
        if (Array.isArray(top)) {
          setTopItemsErr(null);
          setTopItems(top);
        } else {
          setTopItemsErr(getErrorMessage(top as ApiError));
          setTopItems([]);
        }
        setTopItemsLoading(false);
      }
      const d = await getPosDaily({ from, to });
      if (!cancelled) {
        if (Array.isArray(d)) {
          setDailyErr(null);
          setDaily(d);
        } else {
          setDailyErr(getErrorMessage(d as ApiError));
          setDaily([]);
        }
        setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm" data-testid="e2e-pos-reports">
      <div className="border-b border-brand-surface pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-content">業績概覽</h2>
            <p className="mt-1 text-sm text-muted">
              資料來源 GET /pos/reports/summary；區間：{periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">時間區段</span>
            <select
              className="rounded-xl border border-brand-surface bg-white px-3 py-1.5 text-sm"
              value={preset}
              onChange={(e) => {
                const next = e.target.value as PosReportsPreset;
                setPreset(next);
                const params = new URLSearchParams(searchParams);
                if (next === 'today') {
                  params.delete('preset');
                } else {
                  params.set('preset', next);
                }
                navigate({ pathname: '/pos/reports', search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
              }}
            >
              <option value="today">今日</option>
              <option value="last7d">近 7 日</option>
              <option value="last30d">近 30 日</option>
              <option value="currentMonth">本月</option>
              <option value="last60d">近 60 日</option>
              <option value="lastHalfYear">近半年</option>
            </select>
          </div>
        </div>
      </div>
      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLoading && !data ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`${cardBase} animate-pulse`}
              >
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="mt-3 h-6 w-20 rounded bg-slate-200" />
              </div>
            ))}
          </>
        ) : data ? (
          <>
            <div className={`${cardBase} kpi-card-accent-blue`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">營收合計</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{money(data.totalRevenue)}</div>
            </div>
            <div className={`${cardBase} kpi-card-accent-green`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">訂單筆數</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{data.ordersCount}</div>
            </div>
            <div className={`${cardBase} kpi-card-accent-amber`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">平均客單</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{money(data.avgOrder)}</div>
            </div>
            <div className={`${cardBase} kpi-card-accent-slate`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">退款筆數</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{data.refundsCount}</div>
              <div className="mt-1 text-xs text-muted">金額 {money(data.refundsTotal)}</div>
            </div>
          </>
        ) : null}
      </div>

      {data && (
      <div className="mt-8 rounded-2xl border border-brand-surface bg-table-head p-4">
        <h3 className="mb-3 text-sm font-semibold text-content">毛利分析</h3>
        {data.grossMargin != null && data.grossMarginRate != null ? (
          <div className="flex flex-wrap gap-6 text-sm">
            {data.totalCost != null && (
              <div>
                <span className="text-muted">銷貨成本</span>
                <span className="ml-2 font-medium tabular-nums text-content">{money(data.totalCost)}</span>
              </div>
            )}
            <div>
              <span className="text-muted">毛利</span>
              <span className="ml-2 font-semibold tabular-nums text-content">{money(data.grossMargin)}</span>
            </div>
            <div>
              <span className="text-muted">毛利率</span>
              <span className="ml-2 font-semibold tabular-nums text-content">{data.grossMarginRate}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">毛利率需商品設定成本價（costPrice）後由後端彙總；若商品尚未設定成本，此區為空。</p>
        )}
      </div>
      )}
      {data && data.ordersCount === 0 && !err && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          此區間尚無訂單，以下報表區塊可能為空。
        </div>
      )}

      {data?.byPaymentMethod && Object.keys(data.byPaymentMethod).length > 0 && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-table-head p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">付款方式分布</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-brand-surface text-muted">
                <tr>
                  <th className="px-3 py-1.5">付款方式</th>
                  <th className="px-3 py-1.5">金額</th>
                  <th className="px-3 py-1.5">占比</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.byPaymentMethod).map(([method, amount]) => {
                  const total = Object.values(data.byPaymentMethod ?? {}).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
                  return (
                    <tr key={method} className="border-t border-brand-surface">
                      <td className="px-3 py-1.5 text-content">{method}</td>
                      <td className="px-3 py-1.5 tabular-nums">{money(String(amount))}</td>
                      <td className="px-3 py-1.5 text-muted">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topItemsErr && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          熱銷品項載入失敗：{topItemsErr}
        </div>
      )}
      {topItemsLoading && !topItemsErr && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">熱銷品項</h3>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
                <div className="h-4 flex-1 rounded bg-slate-200" />
                <div className="h-4 w-10 rounded bg-slate-200" />
                <div className="h-4 w-16 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!topItemsLoading && !topItemsErr && topItems.length === 0 && data && (
        <div className="mt-8 rounded-2xl border border-dashed border-brand-surface bg-white p-4 text-sm text-muted">
          此區間內沒有任何銷售品項。
        </div>
      )}
      {topItems.length > 0 && !topItemsLoading && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">熱銷排行</h3>
          <div className="mb-4">
            <MiniBarChart
              items={topItems.map((row) => ({
                label: row.name ?? row.sku ?? row.productId.slice(0, 8),
                value: row.revenue,
              }))}
              formatValue={(n) => money(String(n))}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="border-b border-brand-surface text-muted">
                <tr>
                  <th className="px-3 py-1.5">品項</th>
                  <th className="px-3 py-1.5">數量</th>
                  <th className="px-3 py-1.5">金額</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((row) => (
                  <tr key={row.productId} className="border-t border-brand-surface">
                    <td className="px-3 py-1.5 text-content">
                      <Link
                        to={`/admin/products?q=${encodeURIComponent(row.sku ?? row.name ?? '')}`}
                        className="text-brand-primary hover:underline"
                      >
                        {row.name ?? row.sku ?? row.productId}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-1.5 tabular-nums">{money(String(row.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data?.byCategory && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">分類銷售</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="border-b border-brand-surface text-muted">
                <tr>
                  <th className="px-3 py-1.5">分類</th>
                  <th className="px-3 py-1.5">營收</th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((row) => (
                  <tr key={row.categoryId ?? 'null'} className="border-t border-brand-surface">
                    <td className="px-3 py-1.5 text-content">
                      {row.categoryCode ?? (row.categoryId ? row.categoryId : '未分類')}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{money(String(row.revenue))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ordersErr && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          銷售明細載入失敗：{ordersErr}
        </div>
      )}
      {orders && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">
            銷售明細（前 {orders.items.length} 筆）
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-brand-surface text-muted">
                <tr>
                  <th className="px-3 py-1.5">單號</th>
                  <th className="px-3 py-1.5">時間</th>
                  <th className="px-3 py-1.5">金額</th>
                  <th className="px-3 py-1.5">客戶</th>
                </tr>
              </thead>
              <tbody>
                {orders.items.map((o) => (
                  <tr key={o.id} className="border-t border-brand-surface">
                    <td className="px-3 py-1.5 font-mono text-xs">
                      <Link
                        to={`/pos/orders/${o.id}`}
                        className="text-brand-primary hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-muted">
                      {new Date(o.createdAt).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{money(String(o.totalAmount))}</td>
                    <td className="px-3 py-1.5 text-content">
                      {o.customerName ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dailyErr && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          區間趨勢載入失敗：{dailyErr}
        </div>
      )}
      {dailyLoading && !dailyErr && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">區間趨勢（按日）</h3>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-2 flex-1 rounded-full bg-slate-200" />
                <div className="h-3 w-16 rounded bg-slate-200" />
                <div className="h-3 w-10 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!dailyLoading && !dailyErr && daily.length === 0 && data && (
        <div className="mt-8 rounded-2xl border border-dashed border-brand-surface bg-white p-4 text-sm text-muted">
          此區間內尚無營收／訂單紀錄。
        </div>
      )}
      {daily.length > 0 && !dailyLoading && (
        <div className="mt-8 rounded-2xl border border-brand-surface bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">日營收趨勢</h3>
          <MiniLineChart
            items={daily.map((row) => ({ label: row.date, value: row.revenue }))}
            formatValue={(n) => money(String(n))}
          />
        </div>
      )}
    </div>
  );
};
