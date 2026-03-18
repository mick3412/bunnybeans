import React from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import { FloatBar } from '../../components/FloatBar';
import { Button } from '../../components/Button';

export const AdminCustomersPage: React.FC = () => (
  <div className="space-y-4">
    <div className="card p-3">
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
        <Link to="/admin/loyalty/members" style={{ color: 'var(--color-primary)' }}>會員管理</Link> 提供完整會員與點數列表。
      </p>
    </div>
    <DataTable columns={[{ key: 'name', label: '姓名' }, { key: 'phone', label: '電話' }]} rows={[]} emptyMessage="尚無會員" />
    <FloatBar left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 0 筆</span>} right={<Button>新增</Button>} />
  </div>
);
