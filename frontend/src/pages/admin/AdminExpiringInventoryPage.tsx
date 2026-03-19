import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getExpiringInventory,
  getWarehouses,
  type ApiError,
  type ExpiringInventoryResult,
  type WarehouseDto,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';
import { Alert } from '../../shared/components/Alert';

const fieldClass =
  'rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';
const cardClass = 'rounded-2xl border border-brand-surface bg-white p-5 shadow-sm';

function yyyyMmDd(s: string) {
  return (s ?? '').slice(0, 10);
}

export const AdminExpiringInventoryPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '');
  const [daysAhead, setDaysAhead] = useState<number>(() => {
    const v = Number(searchParams.get('daysAhead') ?? 30);
    return Number.isFinite(v) && v > 0 ? Math.min(365, Math.max(1, Math.floor(v))) : 30;
  });
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState<number>(() => {
    const v = Number(searchParams.get('page') ?? 1);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1;
  });
  const pageSize = 50;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ExpiringInventoryResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out = await getWarehouses();
      if (cancelled) return;
      if (!Array.isArray(out)) {
        setWarehouses([]);
        return;
      }
      const sorted = [...out].sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'zh-Hant'));
      setWarehouses(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const whNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name || w.code);
    return m;
  }, [warehouses]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (warehouseId) next.set('warehouseId', warehouseId);
    else next.delete('warehouseId');
    next.set('daysAhead', String(daysAhead));
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    next.set('page', String(page));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, daysAhead, q, page]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      const out = await getExpiringInventory({
        warehouseId: warehouseId || undefined,
        daysAhead,
        page,
        pageSize,
      });
      if (cancelled) return;
      setLoading(false);
      const maybeErr = out as unknown as ApiError;
      if (maybeErr && typeof maybeErr === 'object' && 'statusCode' in maybeErr) {
        const msg = getErrorMessage(maybeErr);
        setErr(msg);
        setData(null);
        showToast(msg, 'err');
        return;
      }
      const r = out as unknown as ExpiringInventoryResult;
      setData({
        items: Array.isArray(r.items) ? r.items : [],
        page: typeof r.page === 'number' ? r.page : page,
        pageSize: typeof r.pageSize === 'number' ? r.pageSize : pageSize,
        total: typeof r.total === 'number' ? r.total : (Array.isArray(r.items) ? r.items.length : 0),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [daysAhead, page, showToast, warehouseId]);

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((r) => {
      const sku = (r.sku ?? '').toLowerCase();
      const name = (r.productName ?? '').toLowerCase();
      const batch = (r.batchCode ?? '').toLowerCase();
      return sku.includes(term) || name.includes(term) || batch.includes(term);
    });
  }, [data?.items, q]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const kpi = useMemo(() => {
    const items = data?.items ?? [];
    const uniqueProducts = new Set(items.map((x) => x.productId)).size;
    const qtySum = items.reduce((acc, x) => acc + (Number(x.onHandQty) || 0), 0);
    const earliest = items.map((x) => yyyyMmDd(x.expiryDate)).filter(Boolean).sort()[0];
    return { uniqueProducts, qtySum, earliest: earliest || '—' };
  }, [data?.items]);

  return (
    <div className="mx-auto max-w-6xl space-y-4" data-testid="e2e-admin-expiring-inventory">
      <div className={cardClass}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold text-muted">倉庫</label>
            <select
              className={`${fieldClass} min-w-[220px]`}
              value={warehouseId}
              onChange={(e) => {
                setPage(1);
                setWarehouseId(e.target.value);
              }}
            >
              <option value="">全部倉庫</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.code}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-semibold text-muted">天數（即將到期）</label>
            <select
              className={`${fieldClass} min-w-[160px]`}
              value={daysAhead}
              onChange={(e) => {
                setPage(1);
                setDaysAhead(Number(e.target.value));
              }}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} 天
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-muted">搜尋</label>
            <input
              className={`${fieldClass} w-full`}
              placeholder="SKU / 商品名 / 批號"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>
          <div className="ml-auto text-xs text-muted tabular-nums">
            {loading ? '載入中…' : `共 ${total} 筆`}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-surface bg-table-head p-3">
            <div className="text-[11px] text-muted">批次筆數（本頁）</div>
            <div className="text-lg font-semibold text-content tabular-nums">{data?.items?.length ?? 0}</div>
          </div>
          <div className="rounded-xl border border-brand-surface bg-table-head p-3">
            <div className="text-[11px] text-muted">商品數（本頁）</div>
            <div className="text-lg font-semibold text-content tabular-nums">{kpi.uniqueProducts}</div>
          </div>
          <div className="rounded-xl border border-brand-surface bg-table-head p-3">
            <div className="text-[11px] text-muted">最早到期日（本頁）</div>
            <div className="text-lg font-semibold text-content tabular-nums">{kpi.earliest}</div>
          </div>
        </div>

        {err && (
          <div className="mt-4"><Alert variant="error">{err}</Alert></div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-brand-surface">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-table-head text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left">效期日</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">商品</th>
                <th className="px-3 py-2 text-left">批號</th>
                <th className="px-3 py-2 text-left">倉庫</th>
                <th className="px-3 py-2 text-right">庫存</th>
                <th className="px-3 py-2 text-right">動作</th>
              </tr>
            </thead>
            <tbody className="text-content">
              {filteredItems.map((r) => (
                <tr
                  key={`${r.productId}-${r.warehouseId}-${r.batchCode ?? 'none'}-${r.expiryDate}`}
                  className="border-t border-brand-surface"
                >
                  <td className="px-3 py-2 text-xs tabular-nums">{yyyyMmDd(r.expiryDate)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.sku ?? '—'}</td>
                  <td className="px-3 py-2">{r.productName ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{r.batchCode ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {whNameById.get(r.warehouseId) ?? r.warehouseId}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.onHandQty}</td>
                  <td className="px-3 py-2 text-right">
                    {r.sku ? (
                      <Link
                        className="text-xs font-semibold text-brand-primary hover:underline"
                        to={`/admin/products?q=${encodeURIComponent(r.sku)}`}
                      >
                        看商品
                      </Link>
                    ) : (
                      <span className="text-xs text-[#94a3b8]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-[#64748b]" colSpan={7}>
                    目前沒有即將到期的批次
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              canPrev ? 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]' : 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]'
            }`}
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一頁
          </button>
          <div className="text-xs text-[#64748b] tabular-nums">
            第 {page} / {totalPages} 頁
          </div>
          <button
            type="button"
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              canNext ? 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]' : 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]'
            }`}
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
          >
            下一頁
          </button>
        </div>
      </div>
    </div>
  );
};

