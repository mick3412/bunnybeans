import React, { useEffect, useState } from 'react';
import { KpiCard } from '../../components/KpiCard';
import { getDashboardSummary } from '../../api/dashboard';

export const AdminInventoryPage: React.FC = () => {
  const [summary, setSummary] = useState<{ productCount: number; skuOutOfStockCount: number; skuLowStockCount: number; totalOnHandUnits: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard index={0} label="商品數" value={summary?.productCount ?? '—'} />
        <KpiCard index={1} label="缺貨 SKU" value={summary?.skuOutOfStockCount ?? '—'} />
        <KpiCard index={2} label="低庫存 SKU" value={summary?.skuLowStockCount ?? '—'} />
        <KpiCard index={3} label="庫存總數量" value={summary?.totalOnHandUnits ?? '—'} />
      </div>
      <div className="card p-4">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>依倉庫查詢庫存餘額請使用庫存報表或匯出</p>
      </div>
    </div>
  );
};
