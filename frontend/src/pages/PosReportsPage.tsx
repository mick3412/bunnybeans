import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getPosReportsSummary,
  getPosTopItems,
  getPosDaily,
  listOrders,
  getCategories,
  type ApiError,
  type PosReportsSummaryDto,
  type PosReportsPreset,
  type PosTopItemRow,
  type PosDailyRow,
  type PosOrderListResponse,
} from '../modules/pos/posOrdersApi';
import { getErrorMessage } from '../shared/errors/errorMessages';
import { getPaymentMethodLabel } from '../shared/utils/paymentMethodLabels';
import { MiniBarChart } from '../shared/components/MiniBarChart';
import { MiniLineChart } from '../shared/components/MiniLineChart';
import { useDefaultMerchantId } from '../shared/hooks/useDefaultMerchantId';

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
  const merchantId = useDefaultMerchantId();
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
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let c = false;
    getCategories().then((r) => {
      if (c) return;
      if (Array.isArray(r)) {
        const m: Record<string, string> = {};
        r.forEach((cat) => {
          if (cat.id) m[cat.id] = cat.name ?? cat.code ?? cat.id;
          if (cat.code) m[cat.code] = cat.name ?? cat.code;
        });
        setCategoryNames(m);
      }
    });
    return () => { c = true; };
  }, []);

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
      if (!merchantId) return;
      setSummaryLoading(true);
      const r = await getPosReportsSummary({ preset, merchantId });
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
  }, [preset, merchantId]);

  useEffect(() => {
    if (!data?.period) return;
    const { from, to } = data.period;
    let cancelled = false;
    (async () => {
      setTopItemsLoading(true);
      setDailyLoading(true);
      setTopItemsErr(null);
      setDailyErr(null);
      const ordersRes = await listOrders({ from, to, page: 1, pageSize: 20 });
      if (cancelled) return;
      if ('statusCode' in ordersRes) {
        setOrdersErr(getErrorMessage(ordersRes as ApiError));
        setOrders(null);
      } else {
        setOrdersErr(null);
        setOrders(ordersRes);
      }
      if (!merchantId) {
        setTopItemsErr('無法載入：未選定商家（merchantId）。請確認後台已選商家。');
        setDailyErr('無法載入：未選定商家（merchantId）。請確認後台已選商家。');
        setTopItems([]);
        setDaily([]);
      } else {
        const [top, d] = await Promise.all([
          getPosTopItems({ from, to, limit: 10, sortBy: 'revenue', merchantId }),
          getPosDaily({ from, to, merchantId }),
        ]);
        if (!cancelled) {
          if (Array.isArray(top)) {
            setTopItemsErr(null);
            setTopItems(top);
          } else {
            const e = top as ApiError;
            const base = getErrorMessage(e);
            const apiBase = import.meta.env.VITE_API_BASE_URL;
            const extra = !apiBase || apiBase.trim() === ''
              ? ' 請檢查 VITE_API_BASE_URL 是否已設定（dev 時預設 127.0.0.1:3003）。'
              : '';
            setTopItemsErr(`${base}${extra}`);
            setTopItems([]);
          }
          if (Array.isArray(d)) {
            setDailyErr(null);
            setDaily(d);
          } else {
            const e = d as ApiError;
            const base = getErrorMessage(e);
            const apiBase = import.meta.env.VITE_API_BASE_URL;
            const extra = !apiBase || apiBase.trim() === ''
              ? ' 請檢查 VITE_API_BASE_URL 是否已設定（dev 時預設 127.0.0.1:3003）。'
              : '';
            setDailyErr(`${base}${extra}`);
            setDaily([]);
          }
        }
      }
      if (!cancelled) {
        setTopItemsLoading(false);
        setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, merchantId]);

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

      {data && (data.grossMargin != null || (data.byPaymentMethod && Object.keys(data.byPaymentMethod).length > 0) || (data.byCategory && data.byCategory.length > 0)) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* 毛利分析 */}
          <div className="rounded-xl border border-brand-surface bg-table-head p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">毛利分析</h3>
            {data.grossMargin != null && data.grossMarginRate != null ? (
              <div className="space-y-1 text-xs">
                {data.totalCost != null && (
                  <div><span className="text-muted">成本 </span><span className="font-medium tabular-nums text-content">{money(data.totalCost)}</span></div>
                )}
                <div><span className="text-muted">毛利 </span><span className="font-semibold tabular-nums text-content">{money(data.grossMargin)} ({data.grossMarginRate}%)</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted">需設定 costPrice</p>
            )}
          </div>
          {/* 付款方式分布 */}
          {data.byPaymentMethod && Object.keys(data.byPaymentMethod).length > 0 && (
            <div className="rounded-xl border border-brand-surface bg-table-head p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">付款方式</h3>
              <div className="space-y-1 text-xs">
                {Object.entries(data.byPaymentMethod).slice(0, 5).map(([method, amount]) => {
                  const total = Object.values(data.byPaymentMethod ?? {}).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
                  return (
                    <div key={method} className="flex justify-between gap-2">
                      <span className="text-content">{getPaymentMethodLabel(method)}</span>
                      <span className="tabular-nums text-muted">{money(String(amount))} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* 分類銷售 */}
          {data.byCategory && data.byCategory.length > 0 && (
            <div className="rounded-xl border border-brand-surface bg-table-head p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">分類銷售</h3>
              <div className="max-h-24 space-y-1 overflow-y-auto text-xs">
                {data.byCategory.slice(0, 6).map((row) => (
                  <div key={row.categoryId ?? 'null'} className="flex justify-between gap-2">
                    <span className="truncate text-content">
                      {row.categoryId ? (categoryNames[row.categoryId] ?? categoryNames[row.categoryCode ?? ''] ?? row.categoryCode ?? row.categoryId) : '未分類'}
                    </span>
                    <span className="shrink-0 tabular-nums">{money(String(row.revenue))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {data && data.ordersCount === 0 && !err && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          此區間尚無訂單，以下報表區塊可能為空。
        </div>
      )}

      {(topItemsErr || dailyErr) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {topItemsErr && <div>熱銷品項：{topItemsErr}</div>}
          {dailyErr && <div className={topItemsErr ? 'mt-1' : ''}>區間趨勢：{dailyErr}</div>}
          <div className="mt-1 text-xs opacity-90">
            除錯：merchantId={merchantId ?? 'null'}；VITE_API_BASE_URL={import.meta.env.VITE_API_BASE_URL ? '已設定' : '未設定'}；API 連線請確認後端服務已啟動。
          </div>
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
