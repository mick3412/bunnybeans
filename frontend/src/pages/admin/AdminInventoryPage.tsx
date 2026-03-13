import React, { useEffect, useState } from 'react';
import {
  getWarehouses,
  getBalancesEnriched,
  getInventoryEvents,
  type WarehouseDto,
  type BalanceEnrichedRow,
  type ApiError,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

export const AdminInventoryPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [balances, setBalances] = useState<BalanceEnrichedRow[]>([]);
  const [events, setEvents] = useState<{
    items: {
      id: string;
      type: string;
      quantity: number;
      occurredAt: string;
      note?: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    (async () => {
      const w = await getWarehouses();
      if (!Array.isArray(w)) {
        setErr(getErrorMessage(w as ApiError));
        return;
      }
      setWarehouses(w);
      if (w.length && !warehouseId) setWarehouseId(w[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    setErr(null);
    (async () => {
      const b = await getBalancesEnriched(warehouseId);
      if (!Array.isArray(b)) {
        setErr(getErrorMessage(b as ApiError));
        setBalances([]);
        return;
      }
      setBalances(b);
    })();
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    (async () => {
      const e = await getInventoryEvents({ warehouseId, page, pageSize });
      if (!e || typeof e !== 'object' || !('items' in e)) {
        setErr(getErrorMessage(e as ApiError));
        return;
      }
      setEvents({
        items: e.items,
        total: e.total,
        page: e.page,
        pageSize: e.pageSize,
      });
    })();
  }, [warehouseId, page]);

  const totalPages = events ? Math.max(1, Math.ceil(events.total / pageSize)) : 1;

  return (
    <div className="max-w-5xl" data-testid="e2e-admin-inventory">
      <h1 className="mb-2 text-xl font-bold text-slate-900">庫存餘額與異動</h1>
      <p className="mb-4 text-sm text-slate-500">
        選擇倉庫後檢視即時庫存與事件歷史（append-only）。
      </p>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">倉庫</label>
        <select
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
      </div>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
          庫存餘額
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">品名</th>
                <th className="px-4 py-2 text-right">現量</th>
                <th className="px-4 py-2">更新時間</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    此倉尚無庫存匯總（可自「入庫／盤點」或 POS 銷售後產生）
                  </td>
                </tr>
              ) : (
                balances.map((row) => (
                  <tr key={`${row.productId}-${row.warehouseId}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">{row.sku ?? row.productId.slice(0, 8)}</td>
                    <td className="px-4 py-2">{row.name ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{row.onHandQty}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(row.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
          異動明細
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2">時間</th>
                <th className="px-4 py-2">類型</th>
                <th className="px-4 py-2 text-right">數量</th>
                <th className="px-4 py-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {!events || events.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    無事件
                  </td>
                </tr>
              ) : (
                events.items.map((ev) => (
                  <tr key={ev.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">
                      {new Date(ev.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{ev.type}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{ev.quantity}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-600">
                      {ev.note ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {events && events.total > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              共 {events.total} 筆 · 第 {page} / {totalPages} 頁
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => p - 1)}
              >
                上一頁
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                className="rounded border border-slate-200 px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
