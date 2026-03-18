import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getOrderById, type PosOrderDetail } from '../../api/posOrders';

export const PosOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PosOrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getOrderById(id).then((res) => {
      if ('statusCode' in res) {
        setErr(res.message);
        setData(null);
        return;
      }
      setData(res);
    });
  }, [id]);

  if (err) {
    return (
      <div className="card p-4">
        <p style={{ color: 'var(--color-danger)' }}>{err}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-4">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>載入中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-muted)' }}>訂單編號</dt>
            <dd>{data.orderNumber || data.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-muted)' }}>時間</dt>
            <dd>{data.occurredAt ? new Date(data.occurredAt).toLocaleString('zh-TW') : '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-muted)' }}>總計</dt>
            <dd>{data.totalAmount ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-muted)' }}>已付</dt>
            <dd>{data.paidAmount != null ? data.paidAmount : '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-muted)' }}>待付</dt>
            <dd>{data.remainingAmount != null ? data.remainingAmount : '—'}</dd>
          </div>
        </dl>
        {data.items?.length ? (
          <div className="mt-4">
            <h3 className="section-title mb-2">明細</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-table-head)' }}>
                  <th className="border px-2 py-2 text-left" style={{ borderColor: 'var(--color-border)' }}>數量</th>
                  <th className="border px-2 py-2 text-right" style={{ borderColor: 'var(--color-border)' }}>單價</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border" style={{ borderColor: '#f1f5f9' }}>
                    <td className="px-2 py-2">{item.quantity}</td>
                    <td className="px-2 py-2 text-right">{item.unitPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};
