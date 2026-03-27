import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getPosMarketBasket,
  getStores,
  type ApiError,
  type MarketBasketResponse,
  type MarketBasketPair,
  type PromoFilter,
  type PosReportsPreset,
} from '../modules/pos/posOrdersApi';
import { Alert } from '../shared/components/Alert';
import { getErrorMessage } from '../shared/errors/errorMessages';
import { MiniBarChart } from '../shared/components/MiniBarChart';
import { useDefaultMerchantId } from '../shared/hooks/useDefaultMerchantId';
import { formatMoneyFromString as money } from '../shared/utils/formatMoney';

const cardBase = 'rounded-xl border border-brand-surface bg-white p-4 shadow-sm';

const PROMO_OPTIONS: { value: PromoFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'without_promo', label: '無促銷' },
  { value: 'with_promo', label: '有促銷' },
];

type SortKey = 'coCount' | 'support' | 'confidenceAB' | 'confidenceBA' | 'lift' | 'avgBasketValue';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export const PosMarketBasketPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const merchantId = useDefaultMerchantId();

  const presetFromQuery = (searchParams.get('preset') as PosReportsPreset | null) ?? 'last30d';
  const storeIdFromQuery = searchParams.get('storeId') ?? '';
  const promoFromQuery = (searchParams.get('promoFilter') as PromoFilter | null) ?? 'all';

  const [preset, setPreset] = useState<PosReportsPreset>(presetFromQuery);
  const [storeId, setStoreId] = useState(storeIdFromQuery);
  const [promoFilter, setPromoFilter] = useState<PromoFilter>(promoFromQuery);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<MarketBasketResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('coCount');

  useEffect(() => {
    getStores().then((r) => {
      if (Array.isArray(r)) setStores(r.map((s) => ({ id: s.id, name: s.name })));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    (async () => {
      const r = await getPosMarketBasket({
        preset,
        merchantId,
        storeId: storeId || undefined,
        promoFilter,
        limit: 30,
      });
      if (cancelled) return;
      if ('statusCode' in r) {
        setErr(getErrorMessage(r as ApiError));
        setData(null);
      } else {
        setData(r);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [preset, merchantId, storeId, promoFilter]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (preset !== 'last30d') params.set('preset', preset);
    if (storeId) params.set('storeId', storeId);
    if (promoFilter !== 'all') params.set('promoFilter', promoFilter);
    setSearchParams(params, { replace: true });
  }, [preset, storeId, promoFilter, setSearchParams]);

  const sortedPairs = useMemo(() => {
    if (!data?.pairs) return [];
    return [...data.pairs].sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return vb - va;
    });
  }, [data, sortKey]);

  const periodLabel = useMemo(() => {
    if (!data?.period) return '';
    const map: Record<string, string> = {
      today: '今日', last7d: '近 7 日', last30d: '近 30 日',
      currentMonth: '本月', last60d: '近 60 日', lastHalfYear: '近半年',
    };
    const p = data.period.preset ? (map[data.period.preset] ?? data.period.preset) : '';
    return p ? `${p}（${data.period.from}～${data.period.to}）` : `${data.period.from}～${data.period.to}`;
  }, [data]);

  const topPair = sortedPairs.length > 0 ? sortedPairs[0] : null;

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm" data-testid="e2e-market-basket">
      <div className="border-b border-brand-surface pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-content">共購分析</h2>
            <p className="mt-1 text-sm text-muted">
              哪些商品常被一起購買{periodLabel ? `；區間：${periodLabel}` : ''}
              {' · '}
              <Link className="text-brand-primary hover:underline" to="/pos/reports">返回業績概覽</Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">時間</span>
            <select
              className="rounded-xl border border-brand-surface bg-white px-3 py-1.5 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PosReportsPreset)}
              data-testid="e2e-mb-preset"
            >
              <option value="today">今日</option>
              <option value="last7d">近 7 日</option>
              <option value="last30d">近 30 日</option>
              <option value="currentMonth">本月</option>
              <option value="last60d">近 60 日</option>
              <option value="lastHalfYear">近半年</option>
            </select>
            <span className="text-xs text-muted">門市</span>
            <select
              className="rounded-xl border border-brand-surface bg-white px-3 py-1.5 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              data-testid="e2e-mb-store"
            >
              <option value="">全部門市</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="text-xs text-muted">促銷</span>
            <div className="inline-flex rounded-lg border border-brand-surface" data-testid="e2e-mb-promo-filter">
              {PROMO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium first:rounded-l-lg last:rounded-r-lg ${
                    promoFilter === opt.value
                      ? 'bg-brand-primary text-white'
                      : 'bg-white text-content hover:bg-brand-surface'
                  }`}
                  onClick={() => setPromoFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {err && (
        <Alert variant="error" className="mt-4">{err}</Alert>
      )}

      {loading && !data && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <div className="h-3 w-16 rounded bg-brand-surface" />
              <div className="mt-3 h-6 w-20 rounded bg-brand-surface" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className={`${cardBase} kpi-card-accent-blue`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">符合條件訂單</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{data.totalOrders}</div>
            </div>
            <div className={`${cardBase} kpi-card-accent-green`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">多品項訂單</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-content">
                {data.multiItemOrders}
                <span className="ml-2 text-sm font-normal text-muted">
                  ({data.totalOrders > 0 ? ((data.multiItemOrders / data.totalOrders) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
            <div className={`${cardBase} kpi-card-accent-amber`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">最高共購組合</div>
              <div className="mt-2 text-lg font-semibold text-content truncate">
                {topPair ? `${topPair.productA.name} + ${topPair.productB.name}` : '—'}
              </div>
              {topPair && (
                <div className="mt-1 text-xs text-muted">共現 {topPair.coCount} 次</div>
              )}
            </div>
          </div>

          {sortedPairs.length > 0 && (
            <div className="mt-6 rounded-xl border border-brand-surface bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-content">Top 10 共購組合</h3>
              <MiniBarChart
                items={sortedPairs.slice(0, 10).map((p) => ({
                  label: `${p.productA.name} + ${p.productB.name}`,
                  value: p.coCount,
                }))}
                formatValue={(n) => `${n} 次`}
              />
            </div>
          )}

          {sortedPairs.length > 0 && (
            <div className="mt-6 rounded-xl border border-brand-surface bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-content">共購排行</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-brand-surface text-muted">
                    <tr>
                      <th className="px-3 py-1.5">#</th>
                      <th className="px-3 py-1.5">商品 A</th>
                      <th className="px-3 py-1.5">商品 B</th>
                      <SortTh current={sortKey} k="coCount" label="共現次數" set={setSortKey} />
                      <SortTh current={sortKey} k="support" label="支援度" set={setSortKey} />
                      <SortTh current={sortKey} k="confidenceAB" label="信賴度 A→B" set={setSortKey} />
                      <SortTh current={sortKey} k="confidenceBA" label="信賴度 B→A" set={setSortKey} />
                      <SortTh current={sortKey} k="lift" label="提升度" set={setSortKey} />
                      <SortTh current={sortKey} k="avgBasketValue" label="平均客單" set={setSortKey} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPairs.map((pair, idx) => (
                      <tr key={`${pair.productA.id}-${pair.productB.id}`} className="border-t border-brand-surface">
                        <td className="px-3 py-1.5 text-muted">{idx + 1}</td>
                        <td className="px-3 py-1.5 text-content">{pair.productA.name}</td>
                        <td className="px-3 py-1.5 text-content">{pair.productB.name}</td>
                        <td className="px-3 py-1.5 tabular-nums font-medium">{pair.coCount}</td>
                        <td className="px-3 py-1.5 tabular-nums">{pct(pair.support)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{pct(pair.confidenceAB)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{pct(pair.confidenceBA)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{pair.lift.toFixed(2)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{money(String(pair.avgBasketValue))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sortedPairs.length === 0 && !loading && (
            <div className="mt-6 rounded-2xl border border-dashed border-brand-surface bg-white p-4 text-sm text-muted">
              此條件下尚無共購組合（可能訂單不足或皆為單品訂單）。
            </div>
          )}
        </>
      )}
    </div>
  );
};

function SortTh(props: { current: SortKey; k: SortKey; label: string; set: (k: SortKey) => void }) {
  const active = props.current === props.k;
  return (
    <th
      className={`cursor-pointer select-none px-3 py-1.5 text-right ${active ? 'text-brand-primary font-semibold' : ''}`}
      onClick={() => props.set(props.k)}
    >
      {props.label}{active ? ' ▼' : ''}
    </th>
  );
}
