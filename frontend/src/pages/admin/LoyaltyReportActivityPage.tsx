import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getLoyaltyReportActivity, type ApiError } from '../../modules/admin/adminApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { Button } from '../../shared/components/Button';
import { EmptyState } from '../../shared/components/EmptyState';
import { KpiCard } from '../../shared/components/KpiCard';
import { MiniBarChart } from '../../shared/components/MiniBarChart';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useScopedSearchParams } from '../../shared/utils/useScopedSearchParams';

const PRESETS = [
  { value: '', label: '自訂' },
  { value: 'last30d', label: '近 30 日' },
];

export const LoyaltyReportActivityPage: React.FC = () => {
  const [globalSearchParams] = useSearchParams();
  const [scopedParams, setScopedSearchParams] = useScopedSearchParams('member.reports.activity');
  const merchantIdDefault = useDefaultMerchantId();
  const merchantIdFromUrl = (globalSearchParams.get('merchantId') ?? '').trim();
  const merchantId = merchantIdFromUrl || merchantIdDefault;
  const presetFromUrl = scopedParams.get('preset') ?? globalSearchParams.get('preset') ?? 'last30d';
  const fromFromUrl = scopedParams.get('from') ?? globalSearchParams.get('from') ?? '';
  const toFromUrl = scopedParams.get('to') ?? globalSearchParams.get('to') ?? '';

  const [from, setFrom] = useState(fromFromUrl);
  const [to, setTo] = useState(toFromUrl);
  const [preset, setPreset] = useState(presetFromUrl);
  const [data, setData] = useState<{
    from: string;
    to: string;
    participations: number;
    couponUsage: number;
    pointsCostEstimate: number;
    // v2（後端補強時才會有）
    roi?: number;
    avgCouponUsagePerMember?: number;
    revenueFromPointRedemption?: number;
    byDispatchRule?: { ruleId: string; ruleName?: string | null; jobRunsCount: number; sentCount?: number | null }[];
    byCoupon?: { couponId: string; couponCode?: string | null; name?: string | null; sentCount: number; usedCount: number }[];
    couponUsageByCoupon?: { couponId: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    setErr(null);
    const out = await getLoyaltyReportActivity(merchantId, {
      from: from || undefined,
      to: to || undefined,
      preset: preset || undefined,
      groupBy: 'couponId',
    });
    setLoading(false);
    if (!('participations' in out)) {
      setErr(getErrorMessage(out as ApiError));
      setData(null);
      return;
    }
    setData(out);
  }, [merchantId, from, to, preset]);

  useEffect(() => {
    if (preset === 'last30d' && (!from || !to)) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setFrom(start.toISOString().slice(0, 10));
      setTo(end.toISOString().slice(0, 10));
    }
  }, [preset, from, to]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (preset) next.set('preset', preset);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    setScopedSearchParams(next, { replace: true });
  }, [preset, from, to, setScopedSearchParams]);

  return (
    <StandardListLayout
      title="活動成效報表"
      description={
        <>
          活動／用券／點數成本報表（含點數加倍等促銷效果統計）。資料來源{' '}
          <code className="rounded bg-brand-canvas px-1 text-content">GET /loyalty/reports/activity</code>。
        </>
      }
      testId="e2e-loyalty-report-activity"
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">區間</label>
            <select
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.value || 'custom'} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">起日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">迄日</label>
            <input
              type="date"
              className="rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" variant="primary" disabled={loading} onClick={() => void load()}>
            {loading ? '查詢中…' : '查詢'}
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
      {!loading && !err && !data ? (
        <EmptyState message="尚未查詢" description="" />
      ) : null}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="報表區間"
              sub={`${data.from} ～ ${data.to}`}
              value=""
              accent="slate"
            />
            <KpiCard
              label="發券參與數"
              sub="區間內參與會員數"
              value={String(data.participations)}
              accent="blue"
            />
            <KpiCard
              label="用券筆數"
              sub="實際核銷次數"
              value={String(data.couponUsage)}
              accent="green"
            />
            <KpiCard
              label="點數成本估計"
              sub="以設定點數價值推估"
              value={data.pointsCostEstimate.toLocaleString()}
              accent="amber"
            />
            {typeof data.roi === 'number' && (
              <KpiCard
                label="ROI"
                sub="投報率（後端 v2 指標）"
                value={data.roi.toFixed(2)}
                accent="green"
              />
            )}
            {typeof data.avgCouponUsagePerMember === 'number' && (
              <KpiCard
                label="平均用券次數"
                sub="每位參與會員平均使用"
                value={data.avgCouponUsagePerMember.toFixed(2)}
                accent="blue"
              />
            )}
            {data.revenueFromPointRedemption != null && (
              <KpiCard
                label="折抵帶來營收"
                sub="點數折抵相關訂單總額"
                value={data.revenueFromPointRedemption.toLocaleString()}
                accent="green"
              />
            )}
          </div>
          {data.byDispatchRule && data.byDispatchRule.length > 0 && (
            <div className="rounded-2xl border border-brand-surface bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-[#1e293b]">依發券規則</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-brand-surface text-muted">
                    <tr>
                      <th className="px-3 py-2">規則名稱</th>
                      <th className="px-3 py-2 text-right">job 執行次數</th>
                      <th className="px-3 py-2 text-right">發送數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDispatchRule.map((r) => (
                      <tr key={r.ruleId} className="border-t border-brand-surface">
                        <td className="px-3 py-2">{r.ruleName || r.ruleId}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.jobRunsCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.sentCount ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {data.byCoupon && data.byCoupon.length > 0 && (
            <div className="rounded-2xl border border-brand-surface bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-[#1e293b]">依券成效（發送數／使用數）</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-brand-surface text-muted">
                    <tr>
                      <th className="px-3 py-2">券號／名稱</th>
                      <th className="px-3 py-2 text-right">發送數</th>
                      <th className="px-3 py-2 text-right">使用數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCoupon.map((c) => (
                      <tr key={c.couponId} className="border-t border-brand-surface">
                        <td className="px-3 py-2">
                          <Link
                            to={`/admin/loyalty/coupons?q=${encodeURIComponent(c.couponCode || c.name || c.couponId)}`}
                            className="text-sm font-medium text-sky-700 hover:underline"
                          >
                            {c.couponCode || c.name || c.couponId}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.sentCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.usedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {data.couponUsageByCoupon && data.couponUsageByCoupon.length > 0 && !data.byCoupon?.length && (
            <div className="rounded-2xl border border-brand-surface bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-[#1e293b]">依券用券數</div>
              <MiniBarChart
                items={data.couponUsageByCoupon.map((row) => ({
                  label: row.couponId,
                  value: row.count,
                }))}
              />
            </div>
          )}
        </div>
      )}
    </StandardListLayout>
  );
};
