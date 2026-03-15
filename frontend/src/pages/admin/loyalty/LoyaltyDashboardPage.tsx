import React, { useEffect, useState } from 'react';
import { getLoyaltyDashboard, type LoyaltyDashboardDto } from '../../../modules/admin/loyaltyApi';
import type { ApiError } from '../../../modules/admin/adminApi';
import { useLoyaltyOutletContext } from './LoyaltyLayout';
import { Link } from 'react-router-dom';

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function typeTag(t: string) {
  if (t === 'EARNED') return 'bg-emerald-100 text-emerald-800';
  if (t === 'BURNED') return 'bg-rose-100 text-rose-800';
  if (t === 'LOCKED') return 'bg-amber-100 text-amber-900';
  if (t === 'EXPIRED') return 'bg-neutral-200 text-neutral-700';
  return 'bg-slate-100 text-slate-700';
}

export const LoyaltyDashboardPage: React.FC = () => {
  const { merchantId } = useLoyaltyOutletContext();
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
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">會員集點與促銷總覽</h2>
        <p className="mt-1 text-sm text-neutral-500">
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
        />
        <Card title="本月新增會員" value={data?.newMembersThisMonth ?? '—'} sub="Customer.createdAt 當月" />
        <Card
          title="累計兌回點數"
          value={data?.totalPointsBurnedLifetime ?? '—'}
          sub="歷史 BURNED 絕對值合計"
        />
        <Card title="進行中活動" value={data?.ongoingPromotionsCount ?? '—'} sub="促銷規則 draft=false 且檔期內" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-900">最近點數異動</span>
            <Link
              to="/admin/loyalty/point-ledger"
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              查看存摺
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b text-neutral-500">
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
                    <td colSpan={5} className="py-6 text-center text-neutral-400">
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
                    <td className="py-1.5 pr-2 text-right tabular-nums text-neutral-600">{r.balanceAfter}</td>
                    <td className="whitespace-nowrap py-1.5 text-neutral-500">
                      {new Date(r.createdAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-neutral-900">進行中活動</div>
          <ul className="space-y-2 text-sm">
            {promos.length === 0 && <li className="text-neutral-400">尚無進行中促銷（或皆為草稿）</li>}
            {promos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium text-neutral-800">{p.name}</span>
                <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  進行中
                </span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-500">使用 {p.usageCount}</span>
              </li>
            ))}
          </ul>
          <Link
            to={`/admin/promotions${merchantId ? `?merchantId=${encodeURIComponent(merchantId)}` : ''}`}
            className="mt-3 inline-block text-xs font-medium text-sky-700 hover:underline"
          >
            編輯促銷規則
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50 px-3 py-2 text-[11px] text-neutral-500">
        近 30 日發放 {data?.pointsIssued30d ?? '—'} 點 · 近 30 日兌回 {data?.pointsRedeemed30d ?? '—'} 點 ·
        持有點數會員 {data?.activeMembersWithPoints ?? '—'} 人
      </div>
    </div>
  );
};
