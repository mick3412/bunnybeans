import React, { useEffect, useState } from 'react';
import { KpiCard } from '../../components/KpiCard';
import { DataTable } from '../../components/DataTable';
import { useMerchantId } from '../../hooks/useMerchantId';
import { getLoyaltyDashboard } from '../../api/loyalty';

export const PosPromosPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<Record<string, React.ReactNode>[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getLoyaltyDashboard(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setCount(0);
        setRows([]);
        return;
      }
      const list = res.activePromotions ?? [];
      setCount(list.length);
      setRows(
        list.map((p) => ({
          name: p.name,
          status: p.endsAt ? `至 ${new Date(p.endsAt).toLocaleDateString('zh-TW')}` : '—',
        })),
      );
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard index={0} label="進行中促銷" value={count ?? '—'} />
      </div>
      <DataTable
        columns={[{ key: 'name', label: '促銷名稱' }, { key: 'status', label: '結束日' }]}
        rows={rows}
        emptyMessage="尚無進行中促銷"
      />
    </div>
  );
};
