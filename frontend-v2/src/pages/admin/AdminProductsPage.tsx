import React, { useEffect, useState } from 'react';
import { Toolbar } from '../../components/Toolbar';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { listProducts } from '../../api/products';

export const AdminProductsPage: React.FC = () => {
  const [list, setList] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    listProducts(search ? { search } : undefined).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.map((p) => ({ id: p.id, sku: p.sku, name: p.name })));
    });
  }, [search]);

  const rows = list.map((row) => ({
    name: row.name,
    sku: row.sku,
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
          placeholder="搜尋商品…"
          className="input-base max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Toolbar>
      <DataTable
        columns={[{ key: 'name', label: '商品名稱' }, { key: 'sku', label: 'SKU' }]}
        rows={rows}
        emptyMessage="尚無商品，請新增"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button>新增商品</Button>}
      />
    </div>
  );
};
