import React, { useEffect, useState } from 'react';
import { KpiCard } from '../../components/KpiCard';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { getPosReportsSummary } from '../../api/posOrders';

export const PosReportsPage: React.FC = () => {
  const [summary, setSummary] = useState<{ ordersCount?: number; totalRevenue?: string; avgOrder?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPosReportsSummary().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setSummary(null);
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
        <KpiCard index={0} label="本日訂單數" value={summary?.ordersCount ?? '—'} />
        <KpiCard index={1} label="本日營收" value={summary?.totalRevenue ?? '—'} />
        <KpiCard index={2} label="均單" value={summary?.avgOrder ?? '—'} />
      </div>
      <DataTable columns={[{ key: 'date', label: '日期' }, { key: 'amount', label: '金額' }]} rows={[]} emptyMessage="尚無報表資料" />
      <FloatBar left={null} right={<Button variant="secondary">匯出</Button>} />
    </div>
  );
};
