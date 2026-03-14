import React, { useEffect, useState } from 'react';
import {
  getWarehouses,
  getBalancesEnriched,
  getInventoryEvents,
  fetchCsvExport,
  importInventoryEventsCsv,
  type WarehouseDto,
  type BalanceEnrichedRow,
  type ApiError,
} from '../../modules/admin/adminApi';
import { Button } from '../../shared/components/Button';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useAdminToast } from './AdminToastContext';

export const AdminInventoryPage: React.FC = () => {
  const { showToast } = useAdminToast();
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
  const [exporting, setExporting] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; failed: { row: number; reason: string }[] } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<{ ok?: number; failed?: { row: number; reason: string }[] } | null>(
    null,
  );
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const pageSize = 20;
  const hasAdminKey = Boolean((import.meta.env.VITE_ADMIN_API_KEY as string | undefined)?.trim());

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
      <p className="mb-4 text-sm text-slate-600">
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
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!warehouseId || exporting}
          data-testid="e2e-admin-inventory-export"
          onClick={async () => {
            if (!warehouseId) return;
            setExporting(true);
            setErr(null);
            const q = `inventory/balances/export?warehouseId=${encodeURIComponent(warehouseId)}`;
            const out = await fetchCsvExport(q, `inventory-balances-${warehouseId.slice(0, 8)}.csv`);
            setExporting(false);
            if (out !== true) setErr(getErrorMessage(out as ApiError));
          }}
        >
          {exporting ? '匯出中…' : '匯出餘額 CSV'}
        </Button>
        <div
          className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2"
          data-testid="e2e-admin-inventory-import"
        >
          <span className="text-xs font-semibold text-slate-700">盤點／事件 CSV 匯入</span>
          <p className="mt-0.5 text-[10px] text-slate-500">
            POST /inventory/events/import · 表頭依 api-design（sku、warehouseCode、quantity 等）
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importSubmitting || !hasAdminKey}
            className="mt-1 max-w-[200px] text-xs"
            title={!hasAdminKey ? '需 VITE_ADMIN_API_KEY' : undefined}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f || !hasAdminKey) return;
              setImportSubmitting(true);
              setImportResult(null);
              const out = await importInventoryEventsCsv(f);
              setImportSubmitting(false);
              if ('statusCode' in out) {
                setErr(out.statusCode === 401 ? '需 VITE_ADMIN_API_KEY' : getErrorMessage(out));
                return;
              }
              setErr(null);
              setImportResult(out);
              if (warehouseId) {
                const b = await getBalancesEnriched(warehouseId);
                if (Array.isArray(b)) setBalances(b);
                const ev = await getInventoryEvents({ warehouseId, page: 1, pageSize });
                if (ev && 'items' in ev) {
                  setEvents({
                    items: ev.items,
                    total: ev.total,
                    page: ev.page,
                    pageSize: ev.pageSize,
                  });
                  setPage(1);
                }
              }
            }}
          />
          {importSubmitting && <span className="ml-2 text-xs text-slate-500">上傳中…</span>}
          {importResult && (
            <div className="mt-2 text-xs">
              <span className="text-emerald-700">成功 {importResult.ok} 列</span>
              {importResult.failed.length > 0 && (
                <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto text-red-800">
                  {importResult.failed.slice(0, 20).map((x) => (
                    <li key={`${x.row}-${x.reason}`}>
                      列 {x.row}: {x.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2">
          <span className="text-xs font-semibold text-violet-900">大檔非同步 inventory_csv</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={jobSubmitting || !hasAdminKey}
            className="mt-1 block max-w-[200px] text-xs"
            title={!hasAdminKey ? '需 VITE_ADMIN_API_KEY' : undefined}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f || !hasAdminKey) return;
              setJobSubmitting(true);
              setJobId(null);
              setJobStatus(null);
              setJobError(null);
              setJobResult(null);
              const out = await createImportJob('inventory_csv', f);
              setJobSubmitting(false);
              if ('statusCode' in out) {
                setErr(getErrorMessage(out));
                return;
              }
              setJobId(out.jobId);
              setJobStatus('pending');
              const poll = async (id: string) => {
                for (let i = 0; i < 120; i++) {
                  const j = await getImportJob(id);
                  if ('statusCode' in j) {
                    setJobError(getErrorMessage(j));
                    return;
                  }
                  setJobStatus(j.status);
                  if (j.status === 'done') {
                    setJobResult(j.result);
                    if (warehouseId) {
                      const b = await getBalancesEnriched(warehouseId);
                      if (Array.isArray(b)) setBalances(b);
                      const ev = await getInventoryEvents({ warehouseId, page: 1, pageSize });
                      if (ev && 'items' in ev) {
                        setEvents({
                          items: ev.items,
                          total: ev.total,
                          page: ev.page,
                          pageSize: ev.pageSize,
                        });
                        setPage(1);
                      }
                    }
                    return;
                  }
                  if (j.status === 'failed') {
                    const msg = j.error ?? 'failed';
                    setJobError(msg);
                    showToast(msg, 'err');
                    return;
                  }
                  await new Promise((r) => setTimeout(r, 500));
                }
                setJobError('輪詢逾時');
              };
              void poll(out.jobId);
            }}
          />
          {jobId && (
            <div className="mt-1 text-[10px] text-violet-900">
              {jobId.slice(0, 8)}… {jobStatus}
              {jobResult && ` · ok ${jobResult.ok ?? 0}`}
            </div>
          )}
          {jobError && (
            <div className="mt-2 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900" role="alert">
              非同步 job 失敗：{jobError}
            </div>
          )}
        </div>
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
