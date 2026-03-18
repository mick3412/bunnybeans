import React, { useEffect, useState } from 'react';
import { Toolbar } from '../../components/Toolbar';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { useMerchantId } from '../../hooks/useMerchantId';
import { listSuppliers } from '../../api/purchase';

export const AdminSuppliersPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    listSuppliers(merchantId, q || undefined).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((s) => ({ id: s.id, name: s.name, code: s.code })));
    });
  }, [merchantId, q]);

  const rows = list.map((row) => ({
    name: row.name,
    code: row.code,
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
      <Toolbar>
        <input
          type="search"
          placeholder="搜尋供應商…"
          className="input-base max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Toolbar>
      <DataTable
        columns={[{ key: 'name', label: '供應商名稱' }, { key: 'code', label: '代碼' }]}
        rows={rows}
        emptyMessage="尚無供應商"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button>新增</Button>}
      />
    </div>
  );
};
