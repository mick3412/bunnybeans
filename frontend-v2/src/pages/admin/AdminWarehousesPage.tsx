import React, { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { listWarehouses } from '../../api/warehouses';

export const AdminWarehousesPage: React.FC = () => {
  const [list, setList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listWarehouses().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((w) => ({ id: w.id, code: w.code, name: w.name })));
    });
  }, []);

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
      <DataTable
        columns={[{ key: 'name', label: '名稱' }, { key: 'code', label: '代碼' }]}
        rows={rows}
        emptyMessage="尚無倉庫與門市"
      />
    </div>
  );
};
