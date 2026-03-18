import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Toolbar } from '../../../components/Toolbar';
import { DataTable } from '../../../components/DataTable';
import { FloatBar } from '../../../components/FloatBar';
import { Button } from '../../../components/Button';
import { useMerchantId } from '../../../hooks/useMerchantId';
import { listLoyaltyCustomers, type LoyaltyCustomerRow } from '../../../api/loyalty';

export const LoyaltyMembersPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<LoyaltyCustomerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listLoyaltyCustomers(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setList(res);
    });
  }, [merchantId]);

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  const rows = list.map((row) => ({
    name: (
      <Link to={`/admin/loyalty/point-ledger?customerId=${encodeURIComponent(row.id)}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
        {row.name}
      </Link>
    ),
    phone: row.phone ?? '—',
    memberCode: row.memberCode ?? '—',
    pointBalance: row.pointBalance != null ? String(row.pointBalance) : '—',
    expiringSoon: row.expiringSoon != null ? String(row.expiringSoon) : '—',
  }));

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆會員</span>
      </div>
      <Toolbar>
        <input type="search" placeholder="搜尋姓名、電話、會員編號…" className="input-base max-w-xs" />
      </Toolbar>
      <DataTable
        columns={[
          { key: 'name', label: '姓名' },
          { key: 'phone', label: '電話' },
          { key: 'memberCode', label: '會員編號' },
          { key: 'pointBalance', label: '點數餘額' },
          { key: 'expiringSoon', label: '即將到期' },
        ]}
        rows={rows}
        emptyMessage="尚無會員"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button variant="secondary">匯出</Button>}
      />
    </div>
  );
};
