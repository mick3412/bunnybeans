import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard } from '../../components/KpiCard';
import { SectionTitle } from '../../components/SectionTitle';
import { useMerchantId } from '../../hooks/useMerchantId';
import { getLoyaltyDashboard, type LoyaltyDashboardDto } from '../../api/loyalty';
import { getDashboardSummary } from '../../api/dashboard';

export const AdminDashboardPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [data, setData] = useState<LoyaltyDashboardDto | null>(null);
  const [summary, setSummary] = useState<{ productCount: number; skuOutOfStockCount: number; skuLowStockCount: number; ordersTodayCount: number; totalOnHandUnits: number; inventoryValueApprox: string } | null>(null);
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

  useEffect(() => {
    getDashboardSummary().then((res) => {
      if ('statusCode' in res) return;
      setSummary(res);
    });
  }, []);

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {summary != null && (
        <section>
          <SectionTitle>營運摘要</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard index={0} label="商品數" value={summary.productCount} />
            <KpiCard index={1} label="缺貨 SKU" value={summary.skuOutOfStockCount} />
            <KpiCard index={2} label="低庫存 SKU" value={summary.skuLowStockCount} />
            <KpiCard index={3} label="本日訂單" value={summary.ordersTodayCount} />
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--color-muted)' }}>
            庫存總數量 {summary.totalOnHandUnits ?? '—'}，庫存價值約 {summary.inventoryValueApprox ?? '—'} 元
          </div>
        </section>
      )}
      <section>
        <SectionTitle>集點概況</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard index={0} label="30 天發放點數" value={data?.pointsIssued30d ?? '—'} />
          <KpiCard index={1} label="30 天兌換點數" value={data?.pointsRedeemed30d ?? '—'} />
          <KpiCard index={2} label="有點數會員數" value={data?.activeMembersWithPoints ?? '—'} />
          <KpiCard index={3} label="流通點數總計" value={data?.circulatingPointsTotal ?? '—'} />
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="section-title mb-3">
            最近點數異動
          </h3>
          <div className="max-h-64 overflow-auto">
            {data?.recentLedger?.length ? (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-table-head)' }}>
                    <th className="border-b px-2 py-2 text-left font-semibold" style={{ borderColor: 'var(--color-border)' }}>會員</th>
                    <th className="border-b px-2 py-2 text-left font-semibold" style={{ borderColor: 'var(--color-border)' }}>類型</th>
                    <th className="border-b px-2 py-2 text-right font-semibold" style={{ borderColor: 'var(--color-border)' }}>點數</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLedger.slice(0, 10).map((r) => (
                    <tr key={r.id} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                      <td className="px-2 py-2">{r.customerName ?? '—'}</td>
                      <td className="px-2 py-2">{r.type}</td>
                      <td className="px-2 py-2 text-right">{r.amount > 0 ? `+${r.amount}` : r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>尚無異動</p>
            )}
          </div>
          <p className="mt-2">
            <Link to="/admin/loyalty/point-ledger" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              查看點數存摺
            </Link>
          </p>
        </div>
        <div className="card p-4">
          <h3 className="section-title mb-3">
            進行中促銷
          </h3>
          {data?.activePromotions?.length ? (
            <ul className="space-y-2 text-sm">
              {data.activePromotions.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span style={{ color: 'var(--color-content)' }}>{p.name}</span>
                  <span style={{ color: 'var(--color-muted)' }}>使用 {p.usageCount} 次</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>尚無進行中促銷</p>
          )}
          <p className="mt-2">
            <Link to="/admin/promotions" className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              促銷規則
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};
