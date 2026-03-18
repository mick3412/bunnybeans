import React, { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { listCategories } from '../../api/categories';

export const AdminCategoriesPage: React.FC = () => {
  const [list, setList] = useState<{ id: string; code: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((c) => ({ id: c.id, code: c.code, name: c.name })));
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
        emptyMessage="尚無分類"
      />
    </div>
  );
};
