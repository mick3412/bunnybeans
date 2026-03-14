import React, { useEffect, useState } from 'react';
import {
  getDashboardSummary,
  getCategoriesEnriched,
  type ApiError,
  type DashboardSummaryDto,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

function formatInt(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

function formatMoney(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Forge 式指標卡：大寫標、主數字、副標、趨勢色 */
function MetricCard(props: {
  label: string;
  sub: string;
  value: string;
  trend?: 'up' | 'down' | 'warn';
  trendText?: string;
  dot?: 'amber' | 'red' | 'emerald';
}) {
  const trendColor =
    props.trend === 'up'
      ? 'text-emerald-600'
      : props.trend === 'down'
        ? 'text-amber-600'
        : props.trend === 'warn'
          ? 'text-amber-600'
          : 'text-neutral-400';
  return (
    <div className="rounded-xl border border-neutral-200/90 bg-forge-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{props.label}</p>
        {props.dot === 'amber' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
        {props.dot === 'red' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />}
        {props.dot === 'emerald' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{props.value}</p>
      <p className="mt-1 text-sm text-neutral-500">{props.sub}</p>
      {props.trendText && (
        <p className={`mt-2 text-xs font-medium tabular-nums ${trendColor}`}>{props.trendText}</p>
      )}
    </div>
  );
}

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummaryDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [enrichedHint, setEnrichedHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getDashboardSummary();
      if (cancelled) return;
      if ('statusCode' in res) {
        setErr(getErrorMessage(res as ApiError));
        setData(null);
        return;
      }
      setErr(null);
      setData(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">營運總覽</h2>
          <p className="mt-1 text-sm text-neutral-500">即時庫存與銷售指標（版型參考 Forge Dashboard）</p>
        </div>
        {enrichedHint && (
          <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm">
            {enrichedHint}
          </span>
        )}
      </div>

      {err && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="商品主檔"
          sub="啟用 SKU 筆數"
          value={data ? formatInt(data.productCount) : '—'}
          trend="up"
          trendText={data ? '↑ 與主檔同步' : undefined}
          dot="emerald"
        />
        <MetricCard
          label="缺貨 SKU"
          sub="全倉加總為 0"
          value={data ? formatInt(data.skuOutOfStockCount) : '—'}
          trend="warn"
          trendText={data && data.skuOutOfStockCount > 0 ? '↓ 待補貨' : '—'}
          dot="red"
        />
        <MetricCard
          label="今日銷售單"
          sub="本日建立之 POS 訂單"
          value={data ? formatInt(data.ordersTodayCount) : '—'}
          trend="up"
          trendText="↑ 當日累計"
        />
        <MetricCard
          label="低庫存 SKU"
          sub={data ? `全倉 &lt; ${data.lowStockThreshold} 件` : '低於門檻'}
          value={data ? formatInt(data.skuLowStockCount) : '—'}
          trend="warn"
          dot="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="庫存總件數"
          sub="所有倉 onHand 加總"
          value={data ? formatInt(data.totalOnHandUnits) : '—'}
        />
        <MetricCard
          label="庫存參考金額"
          sub="Σ 件數 × 售價（約值）"
          value={data ? formatMoney(data.inventoryValueApprox) : '—'}
        />
      </div>
    </div>
  );
};
