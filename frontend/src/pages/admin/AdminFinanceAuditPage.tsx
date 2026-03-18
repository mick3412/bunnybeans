import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listFinanceAuditLog, type ApiError, type FinanceAuditLogRow } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useAdminToast } from './AdminToastContext';

const PAGE_SIZES = [50, 100, 200];

export const AdminFinanceAuditPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [eventId, setEventId] = useState(searchParams.get('eventId') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [actor, setActor] = useState(searchParams.get('actor') ?? '');
  const [items, setItems] = useState<FinanceAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize') ?? '100') || 100);
  const [total, setTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const out = await listFinanceAuditLog({
      eventId: eventId.trim() || undefined,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      actor: actor.trim() || undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (!('items' in out)) {
      const msg = getErrorMessage(out as ApiError);
      setErr(msg);
      setItems([]);
      setTotal(null);
      showToast(msg, 'err');
      return;
    }
    setItems(out.items);
    setTotal(typeof out.total === 'number' ? out.total : null);
  }, [eventId, from, to, actor, page, pageSize, showToast]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (eventId.trim()) next.set('eventId', eventId.trim());
    if (from.trim()) next.set('from', from.trim());
    if (to.trim()) next.set('to', to.trim());
    if (actor.trim()) next.set('actor', actor.trim());
    if (page !== 1) next.set('page', String(page));
    if (pageSize !== 100) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [eventId, from, to, actor, page, pageSize, setSearchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    if (total == null) return null;
    return Math.max(1, Math.ceil(total / pageSize) || 1);
  }, [pageSize, total]);

  const description = useMemo(() => {
    return (
      <span>
        金流稽核紀錄。資料來源 <code className="rounded bg-table-head px-1">GET /finance/audit-log</code>（需 Admin key）。
      </span>
    );
  }, []);

  return (
    <StandardListLayout
      title="Finance Audit Log（稽核紀錄）"
      description={description}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">eventId</label>
            <input
              type="text"
              className="w-56 rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm font-mono focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              placeholder="選填"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">起日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">迄日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">actor</label>
            <input
              type="text"
              className="w-40 rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              placeholder="選填"
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button type="button" variant="primary" size="sm" disabled={loading} onClick={() => void load()}>
            {loading ? '查詢中…' : '查詢'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setEventId('');
              setFrom('');
              setTo('');
              setActor('');
              setPage(1);
              setPageSize(100);
            }}
          >
            清除條件
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted">每頁</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-brand-surface bg-white px-2 py-1 text-xs"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      }
      loading={loading}
      error={err}
      empty={!loading && !err && items.length === 0}
      emptyMessage="尚無稽核紀錄"
      emptyDescription="請先設定篩選條件後查詢，或確認後端 Audit Log 已寫入。"
      testId="e2e-admin-finance-audit"
    >
      <div className="overflow-hidden rounded-xl border border-brand-surface bg-white">
        <div className="table-sticky-head overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-2">eventId</th>
                <th className="px-4 py-2">類型</th>
                <th className="px-4 py-2">來源</th>
                <th className="px-4 py-2">摘要</th>
                <th className="px-4 py-2">時間</th>
                <th className="px-4 py-2">actor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-brand-surface hover:bg-brand-canvas">
                  <td className="max-w-[180px] truncate px-4 py-2 font-mono text-xs text-content" title={row.eventId}>
                    {row.eventId}
                  </td>
                  <td className="px-4 py-2 text-content">{row.eventType ?? '—'}</td>
                  <td className="px-4 py-2 text-muted">{row.source ?? '—'}</td>
                  <td className="px-4 py-2 text-muted">{row.amount != null ? `amount=${row.amount}` : '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">{row.createdAt ?? '—'}</td>
                  <td className="px-4 py-2 text-content">{row.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages != null ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-surface bg-table-head px-3 py-2 text-sm text-muted">
            <span className="text-xs">
              共 {total ?? '—'} 筆 · 第 {page} / {totalPages} 頁
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                上一頁
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一頁
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </StandardListLayout>
  );
};
