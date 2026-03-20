import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import { listOpsJobs, runOpsJob, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Alert } from '../../shared/components/Alert';
import { Button } from '../../shared/components/Button';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useAdminToast } from './AdminToastContext';
import { ADMIN_KEY_REQUIRED_HINT, hasAdminApiKey } from '../../shared/rbac/adminKey';

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'crm-run-scheduled', label: 'crm-run-scheduled' },
  { value: 'finance-period-close', label: 'finance-period-close' },
  { value: 'finance-snapshot', label: 'finance-snapshot' },
];

const PAGE_SIZES = [10, 20, 50];

function formatJobTypeLabel(jobType: string) {
  const m: Record<string, string> = {
    'crm-run-scheduled': 'CRM 排程發券',
    'finance-period-close': '金流關帳',
    'finance-snapshot': '金流快照',
  };
  return m[jobType] ?? jobType;
}

export const AdminOpsJobsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const canWrite = hasAdminApiKey();
  const [searchParams, setSearchParams] = useScopedSearchParams('ops.jobs');
  const kindFromUrl = searchParams.get('kind') ?? '';
  const fromFromUrl = searchParams.get('from') ?? '';
  const toFromUrl = searchParams.get('to') ?? '';
  const [items, setItems] = useState<
    { id: string; jobType: string; lastRunAt: string; success: boolean; message: string | null; createdAt: string }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [kind, setKind] = useState(kindFromUrl);
  const [from, setFrom] = useState(fromFromUrl);
  const [to, setTo] = useState(toFromUrl);
  const [runOpen, setRunOpen] = useState(false);
  const [runKind, setRunKind] = useState<'crm-run-scheduled' | 'finance-snapshot'>('crm-run-scheduled');
  const [asOfDate, setAsOfDate] = useState('');
  const [snapshotType, setSnapshotType] = useState<'daily' | 'monthly'>('daily');
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [lastTriggeredRunLogId, setLastTriggeredRunLogId] = useState<string | null>(null);

  const kindLabel = useMemo(() => {
    const m: Record<string, string> = {
      'crm-run-scheduled': 'CRM 排程發券',
      'finance-period-close': '金流關帳',
      'finance-snapshot': '金流快照',
    };
    return kind ? m[kind] ?? kind : '全部';
  }, [kind]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const out = await listOpsJobs({
      page,
      pageSize,
      kind: kind || undefined,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
    });
    setLoading(false);
    if (!('items' in out)) {
      setErr(getErrorMessage(out as ApiError));
      setItems([]);
      setTotal(0);
      return;
    }
    setItems(out.items);
    setTotal(out.total);
  }, [page, pageSize, kind, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (kind) params.set('kind', kind);
    if (from.trim()) params.set('from', from.trim());
    if (to.trim()) params.set('to', to.trim());
    if (page !== 1) params.set('page', String(page));
    if (pageSize !== 20) params.set('pageSize', String(pageSize));
    setSearchParams(params, { replace: true });
  }, [kind, from, to, page, pageSize, setSearchParams]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <StandardListLayout
      title="營運工作執行紀錄"
      description={
        <span>OpsJobRunLog：資料來源 <code className="rounded bg-brand-canvas px-1">GET /ops/jobs</code></span>
      }
      loading={loading}
      error={err ? (
        <div className="flex items-center justify-between gap-3">
          <span>{err}</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>重試</Button>
        </div>
      ) : null}
      empty={!loading && !err && items.length === 0}
      emptyMessage="沒有紀錄"
      emptyDescription={from.trim() || to.trim() ? `目前條件：${kindLabel} · ${from.trim() || '—'} ～ ${to.trim() || '—'}` : `目前條件：${kindLabel}`}
      testId="e2e-admin-ops-jobs"
      filters={
        <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="mr-2 text-xs text-muted">類型</label>
          <select
            className="rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || '_'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mr-2 text-xs text-muted">起始日期</label>
          <input
            type="date"
            className="rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label className="mr-2 text-xs text-muted">截止日期</label>
          <input
            type="date"
            className="rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setFrom('');
            setTo('');
            setPage(1);
          }}
        >
          清除日期
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!canWrite}
          onClick={() => setRunOpen(true)}
        >
          補跑
        </Button>
        {!canWrite ? <span className="text-xs text-muted">{ADMIN_KEY_REQUIRED_HINT}</span> : null}
        <div>
          <label className="mr-2 text-xs text-muted">每頁</label>
          <select
            className="rounded-lg border border-brand-surface bg-white px-3 py-1.5 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-xs text-muted">
          目前篩選：{kindLabel}
          {from.trim() || to.trim() ? ` · ${from.trim() || '—'} ～ ${to.trim() || '—'}` : ''}
        </span>
        </div>
      }
      aboveContent={
        lastTriggeredRunLogId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-content">已觸發補跑</div>
              <div className="mt-0.5 truncate font-mono text-xs text-muted" title={lastTriggeredRunLogId}>
                runLogId：{lastTriggeredRunLogId}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const el = document.getElementById(`runlog-${lastTriggeredRunLogId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              查看（高亮）
            </Button>
          </div>
        ) : null
      }
    >
      {!err && (
      <div className="overflow-hidden rounded-xl border border-brand-surface">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center py-12 text-sm text-muted">載入中…</div>
        ) : items.length === 0 ? null : (
          <div className="table-sticky-head overflow-x-auto bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="w-[220px] px-3 py-2 text-left">作業類型</th>
                  <th className="w-[220px] px-3 py-2 text-right">最近一次執行</th>
                  <th className="w-[120px] px-3 py-2 text-center">結果</th>
                  <th className="px-3 py-2 text-left">訊息</th>
                  <th className="w-[220px] px-3 py-2 text-right">建立時間</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    id={`runlog-${r.id}`}
                    className={[
                      'border-b border-brand-surface hover:bg-table-head',
                      lastTriggeredRunLogId === r.id ? 'bg-brand-primary/5' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2 font-medium text-content">{formatJobTypeLabel(r.jobType)}</td>
                    <td
                      className="px-3 py-2 tabular-nums text-right text-muted"
                      data-testid="e2e-admin-ops-jobs-lastRunAt"
                    >
                      {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString('zh-TW') : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          r.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.success ? '成功' : '失敗'}
                      </span>
                    </td>
                    <td
                      className="max-w-[360px] truncate px-3 py-2 text-left text-muted"
                      title={r.message ?? undefined}
                      data-testid="e2e-admin-ops-jobs-message"
                    >
                      {r.message || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-right text-muted">
                      {new Date(r.createdAt).toLocaleString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-brand-surface bg-table-head px-3 py-2 text-sm text-muted">
            <span>
              共 {total} 筆 · 第 {page} / {totalPages} 頁
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
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
        )}
      </div>
      )}

      {runOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-brand-surface bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-content">手動補跑</div>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-muted hover:bg-brand-canvas"
                onClick={() => setRunOpen(false)}
              >
                關閉
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">種類</label>
                <select
                  className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  value={runKind}
                  onChange={(e) => setRunKind(e.target.value as typeof runKind)}
                >
                  <option value="crm-run-scheduled">CRM 排程發券</option>
                  <option value="finance-snapshot">金流快照</option>
                </select>
              </div>
              {runKind === 'finance-snapshot' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">asOfDate（選填，YYYY-MM-DD）</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">快照類型</label>
                    <select
                      className="w-full rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={snapshotType}
                      onChange={(e) => setSnapshotType(e.target.value as 'daily' | 'monthly')}
                    >
                      <option value="daily">每日</option>
                      <option value="monthly">每月</option>
                    </select>
                  </div>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRunOpen(false)}
                  disabled={runSubmitting}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={runSubmitting || !canWrite}
                  onClick={async () => {
                    if (!confirm('確定要補跑？')) return;
                    setRunSubmitting(true);
                    const out = await runOpsJob({
                      kind: runKind,
                      ...(runKind === 'finance-snapshot'
                        ? { asOfDate: asOfDate || undefined, snapshotType }
                        : {}),
                    });
                    setRunSubmitting(false);
                    if (out && typeof out === 'object' && 'statusCode' in out) {
                      showToast(getErrorMessage(out as ApiError), 'err');
                      return;
                    }
                    const runLogId = (out as { runLogId?: string }).runLogId;
                    if (runLogId) setLastTriggeredRunLogId(runLogId);
                    showToast(runLogId ? `已觸發補跑（runLogId：${runLogId.slice(0, 8)}…）` : '已觸發補跑', 'ok');
                    setRunOpen(false);
                    setKind(runKind);
                    setPage(1);
                    // 清掉日期，避免找不到最新一筆
                    setFrom('');
                    setTo('');
                    void load();
                    if (runLogId) {
                      window.setTimeout(() => {
                        const el = document.getElementById(`runlog-${runLogId}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 200);
                    }
                  }}
                >
                  {runSubmitting ? '送出中…' : '確認補跑'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </StandardListLayout>
  );
};
