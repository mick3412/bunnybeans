import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import {
  createFinanceSnapshot,
  listFinanceSnapshots,
  downloadFinanceSnapshot,
  getFinanceSnapshotById,
  type ApiError,
  type FinanceSnapshotRow,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Button } from '../../shared/components/Button';
import { useAdminToast } from './AdminToastContext';

const PAGE_SIZES = [20, 50, 100];

export const AdminFinanceSnapshotsPage: React.FC = () => {
  const { showToast } = useAdminToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useScopedSearchParams('finance.snapshots');

  const [type, setType] = useState<'daily' | 'monthly' | ''>((searchParams.get('type') as 'daily' | 'monthly' | null) ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize') ?? '50') || 50);

  const [items, setItems] = useState<FinanceSnapshotRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState<'daily' | 'monthly'>('daily');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const out = await listFinanceSnapshots({
      type: type ? (type as 'daily' | 'monthly') : undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (!('items' in out)) {
      const msg = getErrorMessage(out as ApiError);
      setErr(msg);
      setItems([]);
      setTotal(0);
      return;
    }
    setItems(out.items);
    setTotal(out.total);
  }, [page, pageSize, type]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (type) next.set('type', type);
    if (page !== 1) next.set('page', String(page));
    if (pageSize !== 50) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [type, page, pageSize, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const description = useMemo(() => {
    return (
      <span>
        金流快照用於對帳與回溯。若環境尚未提供快照列表，此頁會顯示權限或未就緒錯誤。資料來源{' '}
        <code className="rounded bg-table-head px-1">GET /finance/snapshots</code>（需 Admin 金鑰）。
      </span>
    );
  }, []);

  return (
    <StandardListLayout
      title="金流快照"
      description={description}
      filters={
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">類型</label>
              <select
                className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as 'daily' | 'monthly' | '');
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                <option value="daily">每日</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? '載入中…' : '重新整理'}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-brand-surface bg-brand-canvas/50 px-4 py-3">
            <span className="text-xs font-medium text-muted">手動補跑</span>
            <div>
              <label className="mb-1 block text-xs text-muted">快照日期</label>
              <input
                type="date"
                className="h-9 rounded-lg border border-brand-surface bg-white px-3 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">產出類型</label>
              <select
                className="h-9 rounded-lg border border-brand-surface bg-white px-3 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                value={createType}
                onChange={(e) => setCreateType(e.target.value as 'daily' | 'monthly')}
              >
                <option value="daily">每日</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={creating || !asOfDate}
              onClick={() => {
                void (async () => {
                  setCreating(true);
                  const out = await createFinanceSnapshot({ asOfDate, type: createType });
                  setCreating(false);
                  if (out && typeof out === 'object' && 'statusCode' in out) {
                    showToast(getErrorMessage(out as ApiError), 'err');
                    return;
                  }
                  showToast('已建立快照，請稍候刷新列表', 'ok');
                  void load();
                })();
              }}
            >
              {creating ? '建立中…' : '執行補跑'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate('/admin/ops/jobs?kind=finance-snapshot')}>
              到 Job 監控
            </Button>
          </div>
          <div className="flex items-center gap-2">
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
      emptyMessage="尚無快照"
      emptyDescription="可先到 Job 監控頁補跑 finance-snapshot。"
      testId="e2e-admin-finance-snapshots"
    >
      <div className="overflow-hidden rounded-xl border border-brand-surface bg-white">
        <div className="table-sticky-head overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-2">快照日期</th>
                <th className="px-4 py-2">類型</th>
                <th className="px-4 py-2">檔案路徑</th>
                <th className="px-4 py-2">建立時間</th>
                <th className="px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-brand-surface hover:bg-brand-canvas">
                  <td className="px-4 py-2 tabular-nums text-content">{row.asOfDate}</td>
                  <td className="px-4 py-2 text-muted">{row.type}</td>
                  <td className="max-w-[420px] truncate px-4 py-2 font-mono text-xs text-content" title={row.path}>
                    {row.path}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted">{new Date(row.createdAt).toLocaleString('zh-TW')}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(row.path)
                            .then(() => showToast('已複製 path'))
                            .catch(() => showToast('複製失敗', 'err'));
                        }}
                      >
                        複製路徑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            const out = await getFinanceSnapshotById(row.id);
                            if (out && typeof out === 'object' && 'statusCode' in out) {
                              showToast(getErrorMessage(out as ApiError), 'err');
                              return;
                            }
                            const text = JSON.stringify((out as { summary?: unknown }).summary ?? {}, null, 2);
                            await navigator.clipboard.writeText(text);
                            showToast('已複製摘要 JSON');
                          })().catch(() => showToast('複製失敗', 'err'));
                        }}
                      >
                        查看／複製摘要
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          void (async () => {
                            const out = await downloadFinanceSnapshot(row.id);
                            if (out !== true) {
                              showToast(getErrorMessage(out as ApiError), 'err');
                            }
                          })();
                        }}
                      >
                        下載
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-surface bg-table-head px-3 py-2 text-sm text-muted">
            <span className="text-xs">
              共 {total} 筆 · 第 {page} / {totalPages} 頁
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

