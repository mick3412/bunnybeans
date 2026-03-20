import React, { useEffect, useState } from 'react';
import { getLoyaltyDashboard, type LoyaltyDashboardDto } from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useDefaultMerchantId } from '../../../shared/hooks/useDefaultMerchantId';
import { Link } from 'react-router-dom';

function Card({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string | number;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'slate';
}) {
  const accentClass =
    accent === 'blue'
      ? 'kpi-card-accent-blue'
      : accent === 'green'
        ? 'kpi-card-accent-green'
        : accent === 'amber'
          ? 'kpi-card-accent-amber'
          : accent === 'slate'
            ? 'kpi-card-accent-slate'
            : '';
  return (
    <div className={`rounded-xl border border-brand-surface bg-white p-4 shadow-sm ${accentClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-content">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function typeTag(t: string) {
  if (t === 'EARNED') return 'bg-emerald-100 text-emerald-800';
  if (t === 'BURNED') return 'bg-rose-100 text-rose-800';
  if (t === 'LOCKED') return 'bg-amber-100 text-amber-900';
  if (t === 'EXPIRED') return 'bg-brand-surface text-muted';
  return 'bg-table-head text-muted';
}

export const LoyaltyDashboardPage: React.FC = () => {
  const merchantId = useDefaultMerchantId();
  const [data, setData] = useState<LoyaltyDashboardDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    setErr(null);
    void (async () => {
      const out = await getLoyaltyDashboard(merchantId);
      if ('statusCode' in out) setErr((out as ApiError).message);
      else setData(out);
    })();
  }, [merchantId]);

  const recent = data?.recentLedger ?? [];
  const promos = data?.activePromotions ?? [];

  return (
    <div className="space-y-6">
      <div className="border-b border-brand-surface pb-2">
        <h2 className="text-lg font-semibold text-content">會員集點與促銷總覽</h2>
        <p className="mt-1 text-sm text-muted">
          四張 KPI 與 GET /loyalty/dashboard 擴充欄位一致；近 30 日發放／兌回仍保留於後台統計
        </p>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="流通點數總額"
          value={data?.circulatingPointsTotal ?? '—'}
          sub="目前餘額 &gt;0 合計"
          accent="blue"
        />
        <Card title="本月新增會員" value={data?.newMembersThisMonth ?? '—'} sub="Customer.createdAt 當月" accent="green" />
        <Card
          title="累計兌回點數"
          value={data?.totalPointsBurnedLifetime ?? '—'}
          sub="歷史 BURNED 絕對值合計"
          accent="amber"
        />
        <Card title="進行中活動" value={data?.ongoingPromotionsCount ?? '—'} sub="促銷規則 draft=false 且檔期內" accent="slate" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-content">最近點數異動</span>
            <Link
              to="/admin/loyalty/point-ledger"
              className="text-xs font-medium text-brand-primary hover:underline"
            >
              查看存摺
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-brand-surface bg-table-head text-muted">
                <tr>
                  <th className="py-2 pr-2">會員</th>
                  <th className="py-2 pr-2">類型</th>
                  <th className="py-2 pr-2 text-right">點數</th>
                  <th className="py-2 pr-2 text-right">餘額</th>
                  <th className="py-2">時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      尚無流水
                    </td>
                  </tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[100px] truncate py-1.5 pr-2 font-medium">{r.customerName}</td>
                    <td className="py-1.5 pr-2">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${typeTag(r.type)}`}>{r.type}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.amount > 0 ? `+${r.amount}` : r.amount}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted">{r.balanceAfter}</td>
                    <td className="whitespace-nowrap py-1.5 text-muted">
                      {new Date(r.createdAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-brand-surface bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-content">進行中活動</div>
          <ul className="space-y-2 text-sm">
            {promos.length === 0 && <li className="text-muted">尚無進行中促銷（或皆為草稿）</li>}
            {promos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-brand-surface bg-table-head px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium text-content">{p.name}</span>
                <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  進行中
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">使用 {p.usageCount}</span>
              </li>
            ))}
          </ul>
          <Link
            to={`/admin/promotions${merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : ''}`}
            className="mt-3 inline-block text-xs font-medium text-brand-primary hover:underline"
          >
            編輯促銷規則
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-brand-surface bg-table-head px-3 py-2 text-[11px] text-muted">
        近 30 日發放 {data?.pointsIssued30d ?? '—'} 點 · 近 30 日兌回 {data?.pointsRedeemed30d ?? '—'} 點 ·
        持有點數會員 {data?.activeMembersWithPoints ?? '—'} 人
      </div>
    </div>
  );
};
