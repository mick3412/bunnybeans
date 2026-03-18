import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard } from '../../../components/KpiCard';
import { useMerchantId } from '../../../hooks/useMerchantId';
import { getLoyaltyDashboard, type LoyaltyDashboardDto } from '../../../api/loyalty';

export const LoyaltyDashboardPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [data, setData] = useState<LoyaltyDashboardDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getLoyaltyDashboard(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setData(res);
    });
  }, [merchantId]);

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard index={0} label="30 天發放點數" value={data?.pointsIssued30d ?? '—'} />
        <KpiCard index={1} label="30 天兌換點數" value={data?.pointsRedeemed30d ?? '—'} />
        <KpiCard index={2} label="有點數會員數" value={data?.activeMembersWithPoints ?? '—'} />
        <KpiCard index={3} label="流通點數總計" value={data?.circulatingPointsTotal ?? '—'} />
      </div>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="section-title mb-3">最近點數異動</h3>
          {data?.recentLedger?.length ? (
            <ul className="max-h-48 space-y-1 overflow-auto text-sm">
              {data.recentLedger.slice(0, 8).map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>{r.customerName ?? '—'}</span>
                  <span>{r.amount > 0 ? `+${r.amount}` : r.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>尚無異動</p>
          )}
          <Link to="/admin/loyalty/point-ledger" className="mt-2 inline-block text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            點數存摺
          </Link>
        </div>
        <div className="card p-4">
          <h3 className="section-title mb-3">進行中促銷</h3>
          {data?.activePromotions?.length ? (
            <ul className="space-y-2 text-sm">
              {data.activePromotions.map((p) => (
                <li key={p.id}>{p.name}（使用 {p.usageCount} 次）</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>尚無進行中促銷</p>
          )}
          <Link to="/admin/promotions" className="mt-2 inline-block text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            促銷規則
          </Link>
        </div>
      </section>
    </div>
  );
};
