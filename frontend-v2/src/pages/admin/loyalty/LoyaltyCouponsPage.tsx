import React, { useEffect, useState } from 'react';
import { DataTable } from '../../../components/DataTable';
import { FloatBar } from '../../../components/FloatBar';
import { Button } from '../../../components/Button';
import { StatusTag } from '../../../components/StatusTag';
import { useMerchantId } from '../../../hooks/useMerchantId';
import { listLoyaltyCoupons, type LoyaltyCouponDto } from '../../../api/loyalty';

export const LoyaltyCouponsPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [list, setList] = useState<LoyaltyCouponDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listLoyaltyCoupons(merchantId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setList([]);
        return;
      }
      setList(res.items ?? []);
    });
  }, [merchantId]);

  const rows = list.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.active ? <StatusTag variant="success">啟用</StatusTag> : <StatusTag variant="warning">停用</StatusTag>,
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
        columns={[
          { key: 'code', label: '代碼' },
          { key: 'name', label: '名稱' },
          { key: 'status', label: '狀態' },
        ]}
        rows={rows}
        emptyMessage="尚無優惠券"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {list.length} 筆</span>}
        right={<Button>新增優惠券</Button>}
      />
    </div>
  );
};
