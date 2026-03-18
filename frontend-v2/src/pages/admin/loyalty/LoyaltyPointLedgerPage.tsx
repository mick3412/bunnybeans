import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataTable } from '../../../components/DataTable';
import { FloatBar } from '../../../components/FloatBar';
import { useMerchantId } from '../../../hooks/useMerchantId';
import { getPointLedger, type LedgerItemDto } from '../../../api/loyalty';

export const LoyaltyPointLedgerPage: React.FC = () => {
  const merchantId = useMerchantId();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId') ?? undefined;
  const [items, setItems] = useState<LedgerItemDto[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPointLedger(merchantId, customerId).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        return;
      }
      setItems(res.items);
    });
  }, [merchantId, customerId]);

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  const rows = items.map((r) => ({
    createdAt: new Date(r.createdAt).toLocaleString('zh-TW'),
    customerName: r.customerName ?? '—',
    type: r.type,
    amount: r.amount > 0 ? `+${r.amount}` : String(r.amount),
    balanceAfter: String(r.balanceAfter),
    note: r.note ?? '—',
  }));

  return (
    <div className="space-y-4">
      {customerId && (
        <div className="card p-3">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            篩選：會員 ID {customerId}
          </p>
        </div>
      )}
      <DataTable
        columns={[
          { key: 'createdAt', label: '時間' },
          { key: 'customerName', label: '會員' },
          { key: 'type', label: '類型' },
          { key: 'amount', label: '異動' },
          { key: 'balanceAfter', label: '餘額' },
          { key: 'note', label: '備註' },
        ]}
        rows={rows}
        emptyMessage="尚無點數異動"
      />
      <FloatBar
        left={<span className="text-sm" style={{ color: 'var(--color-muted)' }}>共 {items.length} 筆</span>}
        right={null}
      />
    </div>
  );
};
