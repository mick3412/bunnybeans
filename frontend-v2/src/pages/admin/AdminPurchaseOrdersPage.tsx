import React, { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { useMerchantId } from '../../hooks/useMerchantId';
import { listPurchaseOrders } from '../../api/purchase';

export const AdminPurchaseOrdersPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<{ id: string; orderNumber: string; status?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listPurchaseOrders(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((p) => ({ id: p.id, orderNumber: p.orderNumber ?? p.id, status: p.status })));
    });
  }, [merchantId]);

  const rows = list.map((row) => ({
    po: row.orderNumber,
    status: row.status ?? '—',
  }));

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>
      </div>
      <DataTable
        columns={[{ key: 'po', label: '採購單號' }, { key: 'status', label: '狀態' }]}
        rows={rows}
        emptyMessage="尚無採購單"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button>新增採購單</Button>}
      />
    </div>
  );
};
