import React, { useEffect, useState } from 'react';
import { KpiCard } from '../../components/KpiCard';
import {
  getFinanceSummaryToday,
  getFinanceSummaryWeek,
  getFinanceEvents,
  exportFinanceEventsCsv,
  type FinanceEventRow,
} from '../../api/finance';
import { Button } from '../../components/Button';

const PAGE_SIZE = 20;

export const AdminReportsPage: React.FC = () => {
  const [today, setToday] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [events, setEvents] = useState<FinanceEventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getFinanceSummaryToday().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setToday(res.total);
    });
  }, []);

  useEffect(() => {
    getFinanceSummaryWeek().then((res) => {
      if ('statusCode' in res) return;
      setWeek(res.total);
    });
  }, []);

  useEffect(() => {
    setEventsLoading(true);
    getFinanceEvents({ preset: 'last30d', page: eventsPage, pageSize: PAGE_SIZE }).then((res) => {
      setEventsLoading(false);
      if ('statusCode' in res) return;
      setEvents(res.items);
      setEventsTotal(res.total);
    });
  }, [eventsPage]);

  const handleExport = () => {
    setExporting(true);
    exportFinanceEventsCsv({ preset: 'last30d' }).then((res) => {
      setExporting(false);
      if (res !== true) {
        setErr(res.message);
      }
    });
  };

  const totalPages = Math.max(1, Math.ceil(eventsTotal / PAGE_SIZE));

  if (err && today == null && week == null) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard index={0} label="本日營收" value={today != null ? today.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'} />
        <KpiCard index={1} label="本週營收" value={week != null ? week.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--color-content)' }}>近期金流事件（近 30 日）</span>
          <Button variant="secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? '匯出中…' : '匯出 CSV'}
          </Button>
        </div>
        {eventsLoading ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>載入中…</p>
        ) : events.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>無事件</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="min-w-full text-left text-sm">
                <thead className="border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                  <tr>
                    <th className="px-2 py-2">類型</th>
                    <th className="px-2 py-2">金額</th>
                    <th className="px-2 py-2">時間</th>
                    <th className="px-2 py-2">參考 ID</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--color-content)' }}>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-2 py-1.5">{e.type}</td>
                      <td className="px-2 py-1.5 tabular-nums">{e.amount} {e.currency}</td>
                      <td className="px-2 py-1.5">{new Date(e.occurredAt).toLocaleString('zh-TW')}</td>
                      <td className="max-w-[120px] truncate px-2 py-1.5 text-xs">{e.referenceId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--color-muted)' }}>
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-[var(--color-table-head)] disabled:opacity-50"
                  disabled={eventsPage <= 1}
                  onClick={() => setEventsPage((p) => p - 1)}
                >
                  上一頁
                </button>
                <span>第 {eventsPage} / {totalPages} 頁，共 {eventsTotal} 筆</span>
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-[var(--color-table-head)] disabled:opacity-50"
                  disabled={eventsPage >= totalPages}
                  onClick={() => setEventsPage((p) => p + 1)}
                >
                  下一頁
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
