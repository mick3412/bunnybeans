import React, { useEffect, useState } from 'react';
import { getPosReportsSummary, type ApiError, type PosReportsSummaryDto } from '../modules/pos/posOrdersApi';
import { getErrorMessage } from '../shared/errors/errorMessages';

function money(s: string) {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);
}

const cardBase =
  'rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2';

export const PosReportsPage: React.FC = () => {
  const [data, setData] = useState<PosReportsSummaryDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      const r = await getPosReportsSummary();
      if (c) return;
      if ('statusCode' in r) {
        setErr(getErrorMessage(r as ApiError));
        setData(null);
      } else {
        setErr(null);
        setData(r);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-zinc-100 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">Today&apos;s performance overview · GET /pos/reports/summary</p>
      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!data && !err ? (
          <div className="col-span-full py-12 text-center text-slate-500">載入中…</div>
        ) : data ? (
          <>
            <div className={cardBase}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-lg" aria-hidden>
                $
              </span>
              <div className="text-sm font-medium text-slate-600">Total Revenue</div>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{money(data.totalRevenue)}</div>
            </div>
            <div className={cardBase}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-lg" aria-hidden>
                🛒
              </span>
              <div className="text-sm font-medium text-slate-600">Orders</div>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{data.ordersCount}</div>
            </div>
            <div className={cardBase}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-lg" aria-hidden>
                📈
              </span>
              <div className="text-sm font-medium text-slate-600">Avg Order</div>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{money(data.avgOrder)}</div>
            </div>
            <div className={cardBase}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-lg" aria-hidden>
                ↺
              </span>
              <div className="text-sm font-medium text-slate-600">Refunds</div>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{data.refundsCount}</div>
              <div className="text-xs text-slate-500">金額 {money(data.refundsTotal)}</div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
