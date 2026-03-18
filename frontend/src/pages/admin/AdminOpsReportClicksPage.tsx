import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  listReportClickAudit,
  summaryReportClickAudit,
  type ApiError,
  type ReportClickAuditRow,
} from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { Button } from '../../shared/components/Button';
import { ReferenceIdLink } from '../../shared/components/ReferenceIdLink';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';

const PAGE_SIZES = [20, 50, 100];
const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部' },
  { value: 'posOrder', label: 'posOrder' },
  { value: 'receivingNote', label: 'receivingNote' },
  { value: 'unknown', label: 'unknown' },
];

export const AdminOpsReportClicksPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useScopedSearchParams('ops.reportClicks');

  const [source, setSource] = useState(searchParams.get('source') ?? '');
  const [resolvedKind, setResolvedKind] = useState(searchParams.get('kind') ?? '');
  const [success, setSuccess] = useState(searchParams.get('success') ?? '');
  const [resultCode, setResultCode] = useState(searchParams.get('resultCode') ?? '');
  const [referenceId, setReferenceId] = useState(searchParams.get('referenceId') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1') || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize') ?? '50') || 50);

  const [items, setItems] = useState<ReportClickAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    total: number;
    bySuccess: { success: boolean; count: number }[];
    bySource: { source: string; count: number }[];
    byResultCode?: { resultCode: string | null; count: number }[];
    byResolvedKind: { resolvedKind: string; count: number }[];
    topSources?: { source: string; notFound: number; multiMatch: number; total: number }[];
    trendByDay?: { day: string; total: number; failed: number }[];
    topReferenceIds?: { field: string; referenceId: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(7);
  const [trendErr, setTrendErr] = useState<string | null>(null);

  const parsedSuccess = useMemo(() => {
    if (success === 'true') return true;
    if (success === 'false') return false;
    return undefined;
  }, [success]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setTrendErr(null);
    const [listOut, sumOut] = await Promise.all([
      listReportClickAudit({
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        source: source.trim() || undefined,
        resolvedKind: resolvedKind.trim() || undefined,
        resultCode: resultCode.trim() || undefined,
        success: parsedSuccess,
        referenceId: referenceId.trim() || undefined,
        page,
        pageSize,
        order: 'desc',
      }),
      summaryReportClickAudit({
        // 趨勢/健康分數需更長窗：以「今日往回 trendDays」為主，避免使用者不填 from/to 時看不到趨勢
        from:
          from.trim() ||
          (() => {
            const end = new Date();
            const start = new Date(end);
            start.setDate(end.getDate() - (trendDays - 1));
            return start.toISOString().slice(0, 10);
          })(),
        to: to.trim() || new Date().toISOString().slice(0, 10),
        source: source.trim() || undefined,
        resolvedKind: resolvedKind.trim() || undefined,
        resultCode: resultCode.trim() || undefined,
        success: parsedSuccess,
      }),
    ]);
    setLoading(false);
    if (!('items' in listOut)) {
      setErr(getErrorMessage(listOut as ApiError));
      setItems([]);
      setTotal(0);
      setSummary(null);
      return;
    }
    setItems(listOut.items);
    setTotal(listOut.total);
    if ('total' in (sumOut as Record<string, unknown>)) {
      setSummary(sumOut as typeof summary);
    } else {
      setSummary(null);
    }
  }, [from, to, source, resolvedKind, resultCode, parsedSuccess, referenceId, page, pageSize, trendDays]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (source.trim()) next.set('source', source.trim());
    if (resolvedKind.trim()) next.set('kind', resolvedKind.trim());
    if (success) next.set('success', success);
    if (resultCode.trim()) next.set('resultCode', resultCode.trim());
    if (referenceId.trim()) next.set('referenceId', referenceId.trim());
    if (from.trim()) next.set('from', from.trim());
    if (to.trim()) next.set('to', to.trim());
    if (page !== 1) next.set('page', String(page));
    if (pageSize !== 50) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [source, resolvedKind, success, resultCode, referenceId, from, to, page, pageSize, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const returnTo = `${location.pathname}${location.search}`;

  const summaryCards = useMemo(() => {
    if (!summary) return null;
    const ok = summary.bySuccess.find((x) => x.success)?.count ?? 0;
    const fail = summary.bySuccess.find((x) => !x.success)?.count ?? 0;
    const topSources = [...summary.bySource].sort((a, b) => b.count - a.count).slice(0, 5);
    const topKinds = [...summary.byResolvedKind].sort((a, b) => b.count - a.count).slice(0, 5);
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="text-xs font-semibold text-muted">總點擊</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-content">{summary.total}</div>
          <div className="mt-2 text-xs text-muted">
            成功 <span className="font-semibold text-brand-success tabular-nums">{ok}</span> · 失敗{' '}
            <span className="font-semibold text-brand-danger tabular-nums">{fail}</span>
          </div>
        </div>
        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="text-xs font-semibold text-muted">來源 Top 5</div>
          <div className="mt-2 space-y-1 text-xs">
            {topSources.length ? (
              topSources.map((r) => (
                <div key={r.source} className="flex items-center justify-between gap-2">
                  <span className="truncate text-content">{r.source}</span>
                  <span className="shrink-0 tabular-nums text-muted">{r.count}</span>
                </div>
              ))
            ) : (
              <div className="text-muted">—</div>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="text-xs font-semibold text-muted">解析 kind Top 5</div>
          <div className="mt-2 space-y-1 text-xs">
            {topKinds.length ? (
              topKinds.map((r) => (
                <div key={r.resolvedKind} className="flex items-center justify-between gap-2">
                  <span className="truncate text-content">{r.resolvedKind}</span>
                  <span className="shrink-0 tabular-nums text-muted">{r.count}</span>
                </div>
              ))
            ) : (
              <div className="text-muted">—</div>
            )}
          </div>
        </div>
      </div>
    );
  }, [summary]);

  const healthCards = useMemo(() => {
    if (!summary) return null;
    const total = summary.total || 0;
    const byCode = summary.byResultCode ?? [];
    const notFound = byCode.find((x) => x.resultCode === 'NOT_FOUND')?.count ?? 0;
    const multiMatch = byCode.find((x) => x.resultCode === 'MULTI_MATCH')?.count ?? 0;
    const navigated = byCode.find((x) => x.resultCode === 'NAVIGATED')?.count ?? 0;
    const permission = byCode.find((x) => x.resultCode === 'PERMISSION')?.count ?? 0;
    const notFoundRate = total ? notFound / total : 0;
    const multiMatchRate = total ? multiMatch / total : 0;
    const navigatedRate = total ? navigated / total : 0;
    const okRate = total ? (summary.bySuccess.find((x) => x.success)?.count ?? 0) / total : 0;

    const status = (() => {
      if (total === 0) return { label: 'OK', cls: 'bg-table-head text-muted ring-1 ring-brand-surface', note: '尚無資料' };
      if (notFoundRate >= 0.2 || multiMatchRate >= 0.08 || okRate < 0.8)
        return { label: 'ALERT', cls: 'bg-brand-danger/10 text-brand-danger ring-1 ring-brand-danger/20', note: '需優先處理' };
      if (notFoundRate >= 0.08 || multiMatchRate >= 0.03 || okRate < 0.9)
        return { label: 'WARN', cls: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20', note: '建議排程修正' };
      return { label: 'OK', cls: 'bg-brand-success/10 text-brand-success ring-1 ring-brand-success/20', note: '狀態良好' };
    })();

    const topSources = summary.topSources ?? [];
    const trend = summary.trendByDay ?? [];
    const topRefs = summary.topReferenceIds ?? [];

    return (
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted">健康分數</div>
            <span className={['inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', status.cls].join(' ')}>
              {status.label}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted">{status.note}</div>
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">NOT_FOUND 比例</span>
              <span className="font-mono tabular-nums text-content">{Math.round(notFoundRate * 1000) / 10}%</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">MULTI_MATCH 比例</span>
              <span className="font-mono tabular-nums text-content">{Math.round(multiMatchRate * 1000) / 10}%</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">NAVIGATED 比例</span>
              <span className="font-mono tabular-nums text-content">{Math.round(navigatedRate * 1000) / 10}%</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">成功率（success）</span>
              <span className="font-mono tabular-nums text-content">{Math.round(okRate * 1000) / 10}%</span>
            </div>
            {permission ? <div className="text-[11px] text-muted">PERMISSION：{permission} 次（可能缺 Admin key）</div> : null}
          </div>
        </div>

        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted">NOT_FOUND / MULTI_MATCH 排行（source）</div>
            <div className="text-[11px] text-muted">依 summary.topSources</div>
          </div>
          {topSources.length ? (
            <div className="mt-3 space-y-1 text-xs">
              {topSources.slice(0, 6).map((r) => (
                <div key={r.source} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-content">{r.source}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    NF {r.notFound} · MM {r.multiMatch}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-muted">—</div>
          )}
        </div>

        <div className="rounded-xl border border-brand-surface bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted">近期趨勢（failed/total）</div>
            <div className="flex items-center gap-1">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
                    trendDays === d ? 'bg-forge-sidebar text-white shadow-sm' : 'bg-table-head text-muted hover:bg-brand-surface',
                  ].join(' ')}
                  onClick={() => setTrendDays(d)}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
          {trend.length ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-brand-surface">
              <table className="w-full min-w-[360px] text-left text-xs">
                <thead className="border-b border-brand-surface bg-table-head text-[11px] font-semibold uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">day</th>
                    <th className="px-3 py-2 text-right">failed</th>
                    <th className="px-3 py-2 text-right">total</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.slice(-trendDays).map((r) => (
                    <tr key={r.day} className="border-t border-brand-surface hover:bg-brand-canvas">
                      <td className="px-3 py-2 font-mono text-[11px] text-content">{r.day}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{r.failed}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 text-xs text-muted">—</div>
          )}
          {topRefs.length ? (
            <div className="mt-3 text-[11px] text-muted">
              常見失敗 referenceId：{topRefs.slice(0, 2).map((x) => `${x.referenceId.slice(0, 8)}…(${x.count})`).join('、')}
            </div>
          ) : null}
        </div>
      </div>
    );
  }, [summary, trendDays]);

  return (
    <StandardListLayout
      title="ReportClickAudit（報表穿透點擊審計）"
      description={
        <span>
          資料來源 <code className="rounded bg-table-head px-1">GET /ops/reports/click-audit</code> 與
          <code className="rounded bg-table-head px-1">GET /ops/reports/click-audit/summary</code>（需 Admin key）。
        </span>
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">來源 source</label>
            <input
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="w-48 rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              placeholder="例如：admin.reports"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">期間</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
              <span className="text-xs text-muted">～</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">解析 kind</label>
            <select
              value={resolvedKind}
              onChange={(e) => {
                setResolvedKind(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value || '_'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">成功</label>
            <select
              value={success}
              onChange={(e) => {
                setSuccess(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              <option value="">全部</option>
              <option value="true">成功</option>
              <option value="false">失敗</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">結果 resultCode</label>
            <input
              value={resultCode}
              onChange={(e) => {
                setResultCode(e.target.value);
                setPage(1);
              }}
              className="w-44 rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm font-mono focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              placeholder="例：NOT_FOUND"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">referenceId</label>
            <input
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
                setPage(1);
              }}
              className="w-64 rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm font-mono focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              placeholder="選填"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? '載入中…' : '重新整理'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSource('');
              setResolvedKind('');
              setSuccess('');
              setReferenceId('');
              setFrom('');
              setTo('');
              setPage(1);
              setPageSize(50);
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
      emptyMessage="沒有點擊審計紀錄"
      emptyDescription="請先設定篩選條件，或確認後端已寫入 click-audit。"
      testId="e2e-admin-ops-report-clicks"
    >
      {summaryCards ? <div className="mb-4">{summaryCards}</div> : null}
      {healthCards ? <div className="mb-4">{healthCards}</div> : null}

      <div className="overflow-hidden rounded-xl border border-brand-surface bg-white">
        <div className="table-sticky-head overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-3 py-2">時間</th>
                <th className="px-3 py-2">source</th>
                <th className="px-3 py-2">field</th>
                <th className="px-3 py-2">referenceId</th>
                <th className="px-3 py-2">resultCode</th>
                <th className="px-3 py-2">resolvedKind</th>
                <th className="px-3 py-2">success</th>
                <th className="px-3 py-2">下一步</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-brand-surface hover:bg-brand-canvas">
                  <td className="px-3 py-2 tabular-nums text-muted">{new Date(r.createdAt).toLocaleString('zh-TW')}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-medium text-content" title={r.source}>
                    {r.source}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.field}</td>
                  <td className="px-3 py-2 font-mono text-xs text-content">
                    <ReferenceIdLink
                      referenceId={r.referenceId}
                      label={r.referenceId.slice(0, 8) + '…'}
                      fallback={<span className="text-xs text-muted">{r.referenceId.slice(0, 8) + '…'}</span>}
                      returnTo={returnTo}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{(r.resultCode as string | null | undefined) ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{r.resolvedKind}</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                        r.success ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger',
                      ].join(' ')}
                    >
                      {r.success ? '成功' : '失敗'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {(() => {
                      const code = String((r as unknown as { resultCode?: string | null }).resultCode ?? '').toUpperCase();
                      if (code === 'MULTI_MATCH') {
                        return (
                          <span>
                            建議：確認條碼資料是否不唯一；POS/庫存掃碼會要求選擇（可用 `E2E-BC-MULTI` 驗證）。
                          </span>
                        );
                      }
                      if (code === 'NOT_FOUND') {
                        return (
                          <span>
                            建議：補齊 fixture 或確認輸入值；可先跑 `pnpm db:seed` → `pnpm --filter pos-erp-backend e2e:seed`。
                          </span>
                        );
                      }
                      return <span>—</span>;
                    })()}
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

