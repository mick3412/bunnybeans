import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '../../shared/components/Alert';
import { Button } from '../../shared/components/Button';
import { Drawer } from '../../shared/components/Drawer';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import { useAdminToast } from './AdminToastContext';
import {
  getCrmJob,
  listCrmJobs,
  type ApiError,
  type CrmJobListItem,
  type CrmJobResult,
} from '../../modules/admin/adminApi';

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'segment-coupon', label: '分群發券（segment-coupon）' },
  { value: 'birthday-coupon', label: '生日發券（birthday-coupon）' },
  { value: 'repurchase-coupon', label: '回購發券（repurchase-coupon）' },
];

const PAGE_SIZES = [10, 20, 50];

function statusLabel(s: string) {
  if (s === 'pending') return { text: '待處理', cls: 'bg-table-head text-muted ring-1 ring-brand-surface' };
  if (s === 'running') return { text: '執行中', cls: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200' };
  if (s === 'done') return { text: '完成', cls: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' };
  if (s === 'failed') return { text: '失敗', cls: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200' };
  return { text: s, cls: 'bg-table-head text-muted ring-1 ring-brand-surface' };
}

export const AdminCrmJobsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const [globalSearchParams] = useSearchParams();
  const [scopedParams, setScopedSearchParams] = useScopedSearchParams('marketing.jobs');
  const merchantIdDefault = useDefaultMerchantId();
  const merchantIdFromUrl = (globalSearchParams.get('merchantId') ?? '').trim();
  const merchantId = merchantIdFromUrl || merchantIdDefault;

  const kindFromUrl = scopedParams.get('kind') ?? globalSearchParams.get('kind') ?? '';
  const fromFromUrl = scopedParams.get('from') ?? globalSearchParams.get('from') ?? '';
  const toFromUrl = scopedParams.get('to') ?? globalSearchParams.get('to') ?? '';
  const jobIdFromUrl = scopedParams.get('jobId') ?? globalSearchParams.get('jobId') ?? '';
  const pageFromUrlRaw = scopedParams.get('page') ?? globalSearchParams.get('page') ?? '1';
  const pageSizeFromUrlRaw = scopedParams.get('pageSize') ?? globalSearchParams.get('pageSize') ?? '20';
  const pageFromUrl = Math.max(1, parseInt(pageFromUrlRaw || '1', 10) || 1);
  const pageSizeFromUrl = Math.max(1, parseInt(pageSizeFromUrlRaw || '20', 10) || 20);

  const [kind, setKind] = useState(kindFromUrl);
  const [from, setFrom] = useState(fromFromUrl);
  const [to, setTo] = useState(toFromUrl);
  const [page, setPage] = useState(pageFromUrl);
  const [pageSize, setPageSize] = useState(pageSizeFromUrl);

  const [items, setItems] = useState<CrmJobListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerJobId, setDrawerJobId] = useState<string | null>(jobIdFromUrl || null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerErr, setDrawerErr] = useState<string | null>(null);
  const [drawerJob, setDrawerJob] = useState<CrmJobResult | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterSummary = useMemo(() => {
    const kindLabel = KIND_OPTIONS.find((o) => o.value === kind)?.label ?? (kind || '全部');
    const range = from.trim() || to.trim() ? `${from.trim() || '—'} ～ ${to.trim() || '—'}` : '不限定期間';
    return `${kindLabel} · ${range}`;
  }, [kind, from, to]);

  const load = useCallback(async () => {
    if (!merchantId) {
      setLoading(false);
      setItems([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setErr(null);
    const out = await listCrmJobs({
      merchantId,
      kind: kind.trim() || undefined,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (!out || typeof out !== 'object' || !('items' in out)) {
      setErr(getErrorMessage(out as ApiError));
      setItems([]);
      setTotal(0);
      return;
    }
    setItems(out.items);
    setTotal(out.total);
  }, [merchantId, kind, from, to, page, pageSize]);

  const openDrawer = useCallback(
    (jobId: string) => {
      setDrawerOpen(true);
      setDrawerJobId(jobId);
      setDrawerJob(null);
      setDrawerErr(null);
    },
    [],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerJobId(null);
    setDrawerJob(null);
    setDrawerErr(null);
  }, []);

  const loadDrawer = useCallback(
    async (jobId: string) => {
      setDrawerLoading(true);
      setDrawerErr(null);
      const out = await getCrmJob(jobId);
      setDrawerLoading(false);
      if (!out || typeof out !== 'object' || !('status' in out)) {
        setDrawerErr(getErrorMessage(out as ApiError));
        setDrawerJob(null);
        return;
      }
      setDrawerJob(out as CrmJobResult);
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams();
    const setOrDel = (k: string, v: string) => {
      if (v.trim()) next.set(k, v.trim());
    };
    setOrDel('kind', kind);
    setOrDel('from', from);
    setOrDel('to', to);
    if (page !== 1) next.set('page', String(page));
    if (pageSize !== 20) next.set('pageSize', String(pageSize));
    if (drawerJobId) next.set('jobId', drawerJobId);

    setScopedSearchParams(next, { replace: true });
  }, [kind, from, to, page, pageSize, drawerJobId, setScopedSearchParams]);

  useEffect(() => {
    if (!jobIdFromUrl) return;
    setDrawerOpen(true);
    setDrawerJobId(jobIdFromUrl);
    void loadDrawer(jobIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!drawerOpen || !drawerJobId) return;
    void loadDrawer(drawerJobId);
  }, [drawerOpen, drawerJobId, loadDrawer]);

  return (
    <StandardListLayout
      title="行銷工作台（Jobs）"
      description={
        <>
          CRM jobs 歷史（分群/生日/回購發券）。資料來源{' '}
          <code className="rounded bg-brand-canvas px-1 text-content">GET /crm/jobs</code>（需 Admin Key）。
        </>
      }
      testId="e2e-admin-crm-jobs"
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">種類</label>
            <select
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
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
            <label className="mb-1 block text-xs text-muted">from</label>
            <input
              type="date"
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">to</label>
            <input
              type="date"
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
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
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            清除日期
          </Button>
          <div>
            <label className="mb-1 block text-xs text-muted">每頁</label>
            <select
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
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
          <span className="ml-auto text-xs text-muted">目前條件：{filterSummary}</span>
        </div>
      }
    >

      {err && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Alert variant="error" className="flex-1 min-w-[200px]">
            {err}
          </Alert>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
            重試
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-brand-surface">
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            <div className="font-medium text-content">沒有紀錄</div>
            <div className="mt-1 text-xs text-muted">
              若預期有資料，請先確認活動/發券規則已建立並執行排程（seed 後再查）。
            </div>
            <div className="mt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                重試
              </Button>
            </div>
          </div>
        ) : (
          <div className="table-sticky-head overflow-x-auto bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold text-muted">
                <tr>
                  <th className="w-[220px] px-3 py-2 text-right">時間</th>
                  <th className="px-3 py-2">種類</th>
                  <th className="w-[110px] px-3 py-2 text-center">狀態</th>
                  <th className="px-3 py-2 font-mono text-xs">segmentId</th>
                  <th className="px-3 py-2 font-mono text-xs">couponId</th>
                  <th className="w-[140px] px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const st = statusLabel(r.status);
                  return (
                    <tr key={r.id} className="border-b border-brand-surface hover:bg-table-head">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-right text-xs text-muted">
                        {new Date(r.createdAt).toLocaleString('zh-TW')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-content">{r.kind}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted">{r.segmentId.slice(0, 10)}…</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-muted">{r.couponId.slice(0, 10)}…</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openDrawer(r.id)}
                        >
                          查看結果
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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

      <Drawer
        open={!!(drawerOpen && drawerJobId)}
        onClose={closeDrawer}
        header={
          <div className="flex w-full items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-content">Job 結果</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted">{drawerJobId}</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void loadDrawer(drawerJobId!)} disabled={drawerLoading}>
                重新整理
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={closeDrawer}>
                關閉
              </Button>
            </div>
          </div>
        }
        ariaLabel="Job 結果"
        widthClassName="w-[min(520px,100vw)]"
      >
        {drawerErr && (
          <Alert variant="error" className="mb-3">
            {drawerErr}
          </Alert>
        )}
        {drawerLoading ? (
          <div className="py-10 text-center text-sm text-muted">載入中…</div>
        ) : drawerJob ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">狀態</span>
              {(() => {
                const st = statusLabel(drawerJob.status);
                return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.text}</span>;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-brand-surface bg-white p-3">
                <div className="text-xs font-semibold text-muted">sent</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-content">{drawerJob.result?.sent ?? 0}</div>
              </div>
              <div className="rounded-xl border border-brand-surface bg-white p-3">
                <div className="text-xs font-semibold text-muted">skipped</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-content">{drawerJob.result?.skipped ?? 0}</div>
              </div>
            </div>
            {drawerJob.error && (
              <Alert variant="error" className="mt-3">
                {drawerJob.error}
              </Alert>
            )}
            {(drawerJob.result?.errors?.length ?? 0) > 0 && (
              <details className="mt-3 rounded-xl border border-brand-surface bg-table-head p-3">
                <summary className="cursor-pointer text-sm font-semibold text-content">
                  錯誤列表（最多 50）
                </summary>
                <ul className="mt-2 max-h-72 list-inside list-disc overflow-y-auto text-sm text-muted">
                  {(drawerJob.result?.errors ?? []).map((e) => (
                    <li key={e} className="break-words">{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-sm text-muted">尚無資料</div>
        )}
      </Drawer>
    </StandardListLayout>
  );
};

