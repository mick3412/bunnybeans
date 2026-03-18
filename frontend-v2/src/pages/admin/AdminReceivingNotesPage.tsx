import React, { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { useMerchantId } from '../../hooks/useMerchantId';
import { listReceivingNotes } from '../../api/purchase';

export const AdminReceivingNotesPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<{ id: string; number: string; status?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listReceivingNotes(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((r) => ({ id: r.id, number: r.number, status: r.status })));
    });
  }, [merchantId]);

  const rows = list.map((row) => ({
    note: row.number,
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
        columns={[{ key: 'note', label: '驗收單號' }, { key: 'status', label: '狀態' }]}
        rows={rows}
        emptyMessage="尚無驗收單"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={null}
      />
    </div>
  );
};
