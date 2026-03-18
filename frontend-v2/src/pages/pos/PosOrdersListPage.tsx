import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KpiCard } from '../../components/KpiCard';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { listOrders, getPosReportsSummary } from '../../api/posOrders';

export const PosOrdersListPage: React.FC = () => {
  const [items, setItems] = useState<{ id: string; orderNumber: string; occurredAt: string; totalAmount: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{ ordersCount?: number; totalRevenue?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listOrders({ pageSize: 50 }).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(res.items ?? []);
      setTotal(res.total ?? res.items?.length ?? 0);
    });
  }, []);

  useEffect(() => {
    getPosReportsSummary().then((res) => {
      if ('statusCode' in res) return;
      setSummary(res);
    });
  }, []);

  const rows = items.map((row) => ({
    id: (
      <Link to={`/pos/orders/${row.id}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
        {row.orderNumber || row.id}
      </Link>
    ),
    time: row.occurredAt ? new Date(row.occurredAt).toLocaleString('zh-TW') : '—',
    amount: row.totalAmount ?? '—',
  }));

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
        <KpiCard index={0} label="本日訂單" value={summary?.ordersCount ?? '—'} />
        <KpiCard index={1} label="本日營收" value={summary?.totalRevenue ?? '—'} />
      </div>
      <DataTable
        columns={[
          { key: 'id', label: '訂單編號' },
          { key: 'time', label: '時間' },
          { key: 'amount', label: '金額' },
        ]}
        rows={rows}
        emptyMessage="尚無訂單"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {total} 筆</span>}
        right={<Button variant="secondary">匯出</Button>}
      />
    </div>
  );
};
