import React, { useCallback, useEffect, useState } from 'react';
import {
  getFinanceEvents,
  fetchCsvExport,
  type ApiError,
  type FinanceEventRow,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const AdminReportsPage: React.FC = () => {
  const [rows, setRows] = useState<FinanceEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preset, setPreset] = useState<'last30d' | 'all' | 'custom'>('last30d');
  const [from, setFrom] = useState(() => {
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return toYmd(t);
  });
  const [to, setTo] = useState(() => toYmd(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const r = await getFinanceEvents({
      preset: preset === 'last30d' ? 'last30d' : undefined,
      from: preset === 'custom' && from.trim() ? `${from.trim()}T00:00:00.000Z` : undefined,
      to: preset === 'custom' && to.trim() ? `${to.trim()}T23:59:59.999Z` : undefined,
      page,
      pageSize,
    });
    if (!r || typeof r !== 'object' || !('items' in r)) {
      setErr(getErrorMessage(r as ApiError));
      setRows([]);
      setTotal(0);
    } else {
      setRows(r.items);
      setTotal(r.total);
    }
    setLoading(false);
  }, [page, pageSize, preset, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-6xl" data-testid="e2e-admin-reports">
      <p className="mb-4 text-sm text-slate-600">
        資料來源 <code className="rounded bg-slate-100 px-1">GET /finance/events</code>
        ；可近 30 日、全部或自訂起訖。可匯出 CSV（與下列區間一致，需 VITE_ADMIN_API_KEY）。
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-600">區間</label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as 'last30d' | 'all' | 'custom');
              setPage(1);
            }}
          >
            <option value="last30d">近 30 日</option>
            <option value="all">全部（未篩日期）</option>
            <option value="custom">自訂 from / to</option>
          </select>
        </div>
        {preset === 'custom' && (
          <>
            <div>
              <label className="mb-1 block text-sm text-slate-600">from</label>
              <input
                type="date"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">to</label>
              <input
                type="date"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
        <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
          重新載入
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setErr(null);
            const params = new URLSearchParams();
            if (preset === 'last30d') params.set('preset', 'last30d');
            if (preset === 'custom' && from.trim()) params.set('from', `${from.trim()}T00:00:00.000Z`);
            if (preset === 'custom' && to.trim()) params.set('to', `${to.trim()}T23:59:59.999Z`);
            const q = `finance/events/export?${params.toString()}`;
            const out = await fetchCsvExport(q, 'finance-events.csv');
            setExporting(false);
            if (out !== true) setErr(getErrorMessage(out as ApiError));
          }}
        >
          {exporting ? '匯出中…' : '匯出 CSV'}
        </Button>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
          載入中…
        </div>
      ) : rows.length === 0 && !err ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
          此條件下尚無金流事件
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2 whitespace-nowrap">時間</th>
                  <th className="px-4 py-2">類型</th>
                  <th className="px-4 py-2 text-right">金額</th>
                  <th className="px-4 py-2">幣別</th>
                  <th className="px-4 py-2 font-mono text-xs">referenceId</th>
                  <th className="px-4 py-2">備註</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <tr key={ev.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-600">
                      {new Date(ev.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{ev.type}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{ev.amount}</td>
                    <td className="px-4 py-2">{ev.currency}</td>
                    <td className="max-w-[120px] truncate px-4 py-2 font-mono text-[10px] text-slate-500">
                      {ev.referenceId ?? '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-600">
                      {ev.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>
                共 {total} 筆 · 第 {page} / {totalPages} 頁
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一頁
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一頁
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
