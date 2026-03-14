import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStores } from '../modules/pos/posOrdersApi';
import { listPromotionRules, type PromotionRuleDto, type ApiError } from '../modules/admin/adminApi';
import { getErrorMessage } from '../shared/errors/errorMessages';

export const PosPromosPage: React.FC = () => {
  const [merchantId, setMerchantId] = useState<string>('');
  const [rows, setRows] = useState<PromotionRuleDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const stores = await getStores();
      if (cancelled) return;
      if (!Array.isArray(stores) || stores.length === 0) {
        setErr(typeof stores === 'object' && stores && 'message' in stores ? (stores as ApiError).message : '無法載入門市');
        setRows([]);
        setLoading(false);
        return;
      }
      const withWh = stores.find((s) => (s.warehouseIds?.length ?? 0) > 0) ?? stores[0];
      const mid = withWh.merchantId ?? stores[0].merchantId ?? '';
      if (!mid) {
        setErr('門市未帶 merchantId，無法載入促銷規則');
        setRows([]);
        setLoading(false);
        return;
      }
      setMerchantId(mid);
      const res = await listPromotionRules({ merchantId: mid, status: 'active' });
      if (cancelled) return;
      if ('statusCode' in res) {
        setErr(getErrorMessage(res as ApiError));
        setRows([]);
      } else {
        setErr(null);
        setRows(res);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full bg-zinc-100 p-6" data-testid="e2e-pos-promos">
      <h1 className="text-2xl font-bold text-slate-900">進行中促銷</h1>
      <p className="mt-1 text-sm text-slate-500">
        與收銀門市同源 <span className="font-mono text-xs">merchantId</span>，僅列出狀態為進行中之規則（唯讀）。
      </p>
      <p className="mt-1 text-sm">
        <Link to="/admin/promotions" className="font-medium text-sky-700 underline">
          後台編輯促銷規則
        </Link>
      </p>

      {loading && <div className="mt-6 text-sm text-slate-500">載入中…</div>}
      {err && !loading && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{err}</div>
      )}
      {!loading && !err && rows.length === 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          目前無進行中之促銷規則
        </div>
      )}
      {!loading && rows.length > 0 && (
        <ul className="mt-6 max-w-2xl space-y-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{p.summary || '—'}</div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    優先序 {p.priority}
                    {p.firstPurchaseOnly ? ' · 首購' : ''}
                    {p.exclusive ? ' · 互斥' : ''}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  進行中
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
