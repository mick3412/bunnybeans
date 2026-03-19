import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  getFinanceEvents,
  getFinanceSummary,
  fetchCsvExport,
  type ApiError,
  type FinanceEventRow,
  type FinanceSummaryByType,
  type FinanceSummaryByPartyId,
} from '../../modules/admin/adminApi';
import { MiniLineChart } from '../../shared/components/MiniLineChart';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { Button } from '../../shared/components/Button';
import { MiniBarChart } from '../../shared/components/MiniBarChart';
import { ReferenceIdLink } from '../../shared/components/ReferenceIdLink';
import { PartyViewSegmented } from '../../shared/components/PartyViewSegmented';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';
import { FINANCE_EVENT_TYPE_LABELS, getFinanceEventTypeLabel } from '../../shared/utils/financeEventTypeLabels';
import { getPartyKindFromId } from '../../shared/utils/partyDisplay';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const FINANCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部類型' },
  ...Object.entries(FINANCE_EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export const AdminReportsPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useScopedSearchParams('finance.reports');
  const presetFromUrl = (searchParams.get('preset') as 'last30d' | 'all' | 'custom' | null) ?? 'last30d';
  const fromFromUrl = searchParams.get('from') ?? '';
  const toFromUrl = searchParams.get('to') ?? '';
  const typeFromUrl = searchParams.get('type') ?? '';
  const partyIdFromUrl = searchParams.get('partyId') ?? '';
  const partyViewFromUrl = (searchParams.get('partyView') as 'all' | 'customer' | 'supplier' | 'other' | null) ?? 'all';

  const [rows, setRows] = useState<FinanceEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preset, setPreset] = useState<'last30d' | 'all' | 'custom'>(presetFromUrl);
  const [from, setFrom] = useState(() => {
    if (fromFromUrl) return fromFromUrl;
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return toYmd(t);
  });
  const [to, setTo] = useState(() => {
    if (toFromUrl) return toFromUrl;
    return toYmd(new Date());
  });
  const [typeFilter, setTypeFilter] = useState<string>(typeFromUrl);
  const [partyId, setPartyId] = useState<string>(partyIdFromUrl);
  const [partyView, setPartyView] = useState<'all' | 'customer' | 'supplier' | 'other'>(partyViewFromUrl);
  const [summary, setSummary] = useState<FinanceSummaryByType | null>(null);
  const [summaryByParty, setSummaryByParty] = useState<FinanceSummaryByPartyId | null>(null);
  const [dailyTrend, setDailyTrend] = useState<{ date: string; receivable: number; payment: number }[]>([]);
  const [prevDailyTrend, setPrevDailyTrend] = useState<{ date: string; receivable: number; payment: number }[]>([]);

  const partyGroupPrefix = useMemo(() => {
    if (partyView === 'customer') return 'customer:';
    if (partyView === 'supplier') return 'supplier:';
    return null;
  }, [partyView]);

  const isGroupMode = useMemo(() => partyView !== 'all' && !partyId.trim(), [partyId, partyView]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const fromParam = preset === 'custom' && from.trim() ? `${from.trim()}T00:00:00.000Z` : undefined;
    const toParam = preset === 'custom' && to.trim() ? `${to.trim()}T23:59:59.999Z` : undefined;
    const presetParam = preset === 'last30d' ? 'last30d' : undefined;

    const partyIdForApi = (() => {
      const pid = partyId.trim();
      if (!pid) return undefined;
      if (partyView === 'customer' && !pid.includes(':')) return `customer:${pid}`;
      if (partyView === 'supplier' && !pid.includes(':')) return `supplier:${pid}`;
      return pid;
    })();

    // group 模式：不填 partyId 時，依視角預設分組（會員/供應商/其他）
    // 後端目前沒有 kind=customer/supplier 的群組篩選，因此用前端過濾達到「預設 group」閱讀體驗。
    // 注意：此模式下分頁 total 以「前端過濾後」為準，避免 UI 看起來卡住或頁數不合理。
    const pageForApi = isGroupMode ? 1 : page;
    const pageSizeForApi = isGroupMode ? 500 : pageSize;

    const [r, sumType, sumParty] = await Promise.all([
      getFinanceEvents({
        preset: presetParam,
        from: fromParam,
        to: toParam,
        page: pageForApi,
        pageSize: pageSizeForApi,
        type: typeFilter || undefined,
        partyId: partyIdForApi,
      }),
      getFinanceSummary({
        preset: presetParam,
        from: fromParam,
        to: toParam,
        groupBy: 'type',
      }),
      getFinanceSummary({
        preset: presetParam,
        from: fromParam,
        to: toParam,
        groupBy: 'partyId',
      }),
    ]);

    if (!r || typeof r !== 'object' || !('items' in r)) {
      setErr(getErrorMessage(r as ApiError));
      setRows([]);
      setTotal(0);
    } else {
      const raw = r.items ?? [];
      const filtered = isGroupMode
        ? raw.filter((ev) => {
            const pid = (ev.partyId ?? '').trim();
            const k = getPartyKindFromId(pid);
            if (partyView === 'customer') return k === 'customer';
            if (partyView === 'supplier') return k === 'supplier';
            if (partyView === 'other') return k !== 'customer' && k !== 'supplier';
            return true;
          })
        : raw;
      setRows(filtered);
      setTotal(isGroupMode ? filtered.length : r.total);
      if (isGroupMode && page !== 1) setPage(1);
    }
    if (sumType && typeof sumType === 'object' && 'byType' in sumType) {
      setSummary(sumType as FinanceSummaryByType);
    } else {
      setSummary(null);
    }
    if (sumParty && typeof sumParty === 'object' && 'byParty' in sumParty) {
      const raw = sumParty as FinanceSummaryByPartyId;
      if (isGroupMode) {
        const byParty = (raw.byParty ?? []).filter((p) => {
          const pid = (p.partyId ?? '').trim();
          const k = getPartyKindFromId(pid);
          if (partyView === 'customer') return k === 'customer';
          if (partyView === 'supplier') return k === 'supplier';
          if (partyView === 'other') return k !== 'customer' && k !== 'supplier';
          return true;
        });
        setSummaryByParty({ byParty });
      } else {
        setSummaryByParty(raw);
      }
    } else {
      setSummaryByParty(null);
    }
    setLoading(false);
  }, [isGroupMode, page, pageSize, preset, from, to, typeFilter, partyId, partyView]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getFinanceEvents({ preset: 'last30d', pageSize: 500 });
      if (cancelled) return;
      if (!r || 'statusCode' in r) {
        setDailyTrend([]);
        return;
      }
      const byDate: Record<string, { receivable: number; payment: number }> = {};
      for (const ev of r.items) {
        const d = ev.occurredAt.slice(0, 10);
        if (!byDate[d]) byDate[d] = { receivable: 0, payment: 0 };
        if (ev.type === 'SALE_RECEIVABLE') byDate[d].receivable += ev.amount;
        else if (ev.type === 'SALE_PAYMENT') byDate[d].payment += ev.amount;
      }
      const sorted = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }));
      setDailyTrend(sorted);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // 本期 vs 上期（同長度區間）：以「近 30 日」為最小可用版本
    let cancelled = false;
    (async () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const prevTo = new Date(from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - 30);
      const r = await getFinanceEvents({
        from: prevFrom.toISOString().slice(0, 10) + 'T00:00:00.000Z',
        to: prevTo.toISOString().slice(0, 10) + 'T23:59:59.999Z',
        pageSize: 500,
      });
      if (cancelled) return;
      if (!r || 'statusCode' in r) {
        setPrevDailyTrend([]);
        return;
      }
      const byDate: Record<string, { receivable: number; payment: number }> = {};
      for (const ev of r.items) {
        const d = ev.occurredAt.slice(0, 10);
        if (!byDate[d]) byDate[d] = { receivable: 0, payment: 0 };
        if (ev.type === 'SALE_RECEIVABLE') byDate[d].receivable += ev.amount;
        else if (ev.type === 'SALE_PAYMENT') byDate[d].payment += ev.amount;
      }
      const sorted = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }));
      setPrevDailyTrend(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // 只用 state 生成 scoped params，避免把 searchParams（依賴項）放進 effect 造成重入更新。
    // setSearchParams 會先清掉 finance.reports.* scope 的 keys，再寫回本 effect 產生的內容。
    const params = new URLSearchParams();
    if (preset === 'last30d') {
      params.set('preset', 'last30d');
    } else if (preset === 'custom') {
      // custom 模式以 from/to 是否存在來定義，不一定需要顯式 preset=custom
      if (from.trim()) params.set('from', from.trim());
      if (to.trim()) params.set('to', to.trim());
    } else if (preset === 'all') {
      params.set('preset', 'all');
    }
    if (typeFilter) params.set('type', typeFilter);
    if (partyId.trim()) params.set('partyId', partyId.trim());
    if (partyView !== 'all') params.set('partyView', partyView);
    // 保留 merchantId（由 AdminLayout 管理/寫入）
    setSearchParams(params, { replace: true });
  }, [preset, from, to, typeFilter, partyId, partyView, setSearchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <StandardListLayout
      title="金流報表"
      description={
        <>
          資料來源 <code className="rounded bg-brand-canvas px-1 text-content">GET /finance/events</code>
        </>
      }
      testId="e2e-admin-reports"
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-muted">區間</label>
            <select
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
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
          <div>
            <label className="mb-1 block text-sm text-muted">類型 (type)</label>
            <select
              className="rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              {FINANCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">對象 (partyId)</label>
            <input
              type="text"
              className="w-40 rounded-lg border border-brand-surface bg-white px-3 py-2 text-sm"
              placeholder="ID（視角可自動加前綴）"
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[240px]">
            <label className="mb-1 block text-sm text-muted">視角</label>
            <PartyViewSegmented
              value={partyView}
              onChange={(v) => {
                setPartyView(v);
                setPage(1);
              }}
            />
          </div>
          {preset === 'custom' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-muted">from</label>
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
                <label className="mb-1 block text-sm text-muted">to</label>
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
              if (typeFilter) params.set('type', typeFilter);
              if (partyId.trim()) params.set('partyId', partyId.trim());
              const q = `finance/events/export?${params.toString()}`;
              const out = await fetchCsvExport(q, 'finance-events.csv');
              setExporting(false);
              if (out !== true) setErr(getErrorMessage(out as ApiError));
            }}
          >
            {exporting ? '匯出中…' : '匯出 CSV'}
          </Button>
        </div>
      }
    >

      {err && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{err}</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
            重試
          </Button>
        </div>
      )}

      {summary?.byType && Object.keys(summary.byType).length > 0 && (
        <>
          <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-2 text-sm font-semibold text-muted">應收／應付摘要（區間內依類型加總）</div>
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(summary.byType).map(([type, amount]) => (
                <span key={type} className="rounded bg-white px-3 py-1.5 shadow-sm">
                  <span className="text-muted">{getFinanceEventTypeLabel(type)}</span>
                  <span className="ml-2 tabular-nums font-medium text-content">{Number(amount).toLocaleString()}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-muted">簡單圖表（依類型）</div>
            <MiniBarChart
              items={Object.entries(summary.byType).map(([type, amount]) => ({
                label: getFinanceEventTypeLabel(type),
                value: Number(amount),
              }))}
            />
          </div>
          {dailyTrend.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-muted">應收 vs 實收趨勢（近 30 日）</div>
              <MiniLineChart
                series={[
                  {
                    name: '應收',
                    items: dailyTrend.map((d) => ({ label: d.date, value: d.receivable })),
                    stroke: '#0ea5e9',
                  },
                  {
                    name: '實收',
                    items: dailyTrend.map((d) => ({ label: d.date, value: d.payment })),
                    stroke: '#16a34a',
                  },
                ]}
                formatValue={(n) => n.toLocaleString()}
              />
            </div>
          )}
          {(dailyTrend.length > 0 || prevDailyTrend.length > 0) && (
            <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-muted">本期 vs 上期（近 30 日對比）</div>
              <p className="mb-3 text-xs text-muted">
                本期：近 30 日；上期：再往前 30 日（同長度區間）。折線呈現「實收（銷售實收）」。
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <div className="mb-2 text-xs font-semibold text-content">本期</div>
                  {dailyTrend.length ? (
                    <MiniLineChart
                      series={[
                        {
                          name: '實收',
                          items: dailyTrend.map((d) => ({ label: d.date, value: d.payment })),
                          stroke: '#16a34a',
                        },
                      ]}
                      formatValue={(n) => n.toLocaleString()}
                    />
                  ) : (
                    <div className="py-6 text-center text-xs text-muted">無資料</div>
                  )}
                </div>
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <div className="mb-2 text-xs font-semibold text-content">上期</div>
                  {prevDailyTrend.length ? (
                    <MiniLineChart
                      series={[
                        {
                          name: '實收',
                          items: prevDailyTrend.map((d) => ({ label: d.date, value: d.payment })),
                          stroke: '#16a34a',
                        },
                      ]}
                      formatValue={(n) => n.toLocaleString()}
                    />
                  ) : (
                    <div className="py-6 text-center text-xs text-muted">無資料</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {summaryByParty?.byParty && summaryByParty.byParty.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-muted">進階圖表（依對象彙總）</div>
                <div className="text-xs text-muted">
                  點對象可前往 <Link className="text-sky-700 hover:underline" to="/admin/balances">應收應付餘額</Link>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {summaryByParty.byParty.slice(0, 10).map((p) => {
                  const kind = getPartyKindFromId(p.partyId);
                  const view = kind === 'customer' ? 'customer' : kind === 'supplier' ? 'supplier' : 'other';
                  const shortId = p.partyId.length > 20 ? p.partyId.slice(0, 12) + '…' : p.partyId;
                  return (
                    <Link
                      key={p.partyId}
                      to={`/admin/balances?view=${encodeURIComponent(view)}&partyId=${encodeURIComponent(p.partyId)}`}
                      className="rounded-full bg-[#f8fafc] px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-[#e2e8f0] hover:bg-white"
                      title={p.partyId}
                      data-testid="e2e-reports-party-drilldown"
                    >
                      {shortId}
                    </Link>
                  );
                })}
              </div>
              <MiniBarChart
                items={summaryByParty.byParty.map((p) => {
                  const total = Object.values(p.amountsByType ?? {}).reduce((s, v) => s + v, 0);
                  const shortId = p.partyId.length > 12 ? p.partyId.slice(0, 8) + '…' : p.partyId;
                  return { label: shortId, value: total };
                })}
                formatValue={(n) => n.toLocaleString()}
              />
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-12 text-center text-muted">
          載入中…
        </div>
      ) : rows.length === 0 && !err ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-12 text-center text-muted">
          此條件下尚無金流事件
        </div>
      ) : (
        <>
          <div className="table-sticky-head overflow-x-auto rounded-xl border border-brand-surface bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-muted">
                <tr>
                  <th className="px-4 py-2 whitespace-nowrap">時間</th>
                  <th className="px-4 py-2">類型</th>
                  <th className="px-4 py-2 text-right">金額</th>
                  <th className="px-4 py-2">幣別</th>
                  <th className="px-4 py-2 font-mono text-xs">參考單據</th>
                  <th className="px-4 py-2">備註</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <tr key={ev.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-muted">
                      {new Date(ev.occurredAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs">{getFinanceEventTypeLabel(ev.type)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{ev.amount}</td>
                    <td className="px-4 py-2">{ev.currency}</td>
                    <td className="max-w-[140px] truncate px-4 py-2 font-mono text-xs text-muted">
                      <ReferenceIdLink
                        referenceId={ev.referenceId ?? null}
                        fallback={ev.referenceId ?? '—'}
                      label="訂單"
                        returnTo={`${location.pathname}${location.search}`}
                        auditSource="admin-reports"
                        auditField="referenceId"
                      />
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-muted">
                      {ev.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
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
    </StandardListLayout>
  );
};
