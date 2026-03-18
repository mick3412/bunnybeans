import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Toolbar } from '../../components/Toolbar';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';
import { StatusTag } from '../../components/StatusTag';
import { useMerchantId } from '../../hooks/useMerchantId';
import { listPromotionRules, type PromotionRuleDto } from '../../api/promotions';

export const AdminPromotionsPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<PromotionRuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    listPromotionRules({ merchantId, q: q || undefined }).then((res) => {
      setLoading(false);
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setErr(null);
      setList(res);
    });
  }, [merchantId, q]);

  const rows = list.map((row) => ({
    name: (
      <Link to={`/admin/promotions/${row.id}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
        {row.name}
      </Link>
    ),
    status: row.status === 'active' ? <StatusTag variant="success">進行中</StatusTag> : row.draft ? <StatusTag variant="info">草稿</StatusTag> : <StatusTag variant="warning">{row.status}</StatusTag>,
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
          placeholder="搜尋促銷…"
          className="input-base max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Toolbar>
      <DataTable
        columns={[{ key: 'name', label: '促銷名稱' }, { key: 'status', label: '狀態' }]}
        rows={rows}
        emptyMessage={loading ? '載入中…' : '尚無促銷規則'}
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button>新增促銷</Button>}
      />
    </div>
  );
};
