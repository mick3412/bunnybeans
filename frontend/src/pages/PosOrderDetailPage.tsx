import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import { getOrderById } from '../modules/pos/posOrdersApi';
import type { PosOrderDetail } from '../modules/pos/posOrdersMockService';

export const PosOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PosOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('缺少訂單 id');
      return;
    }
    let mounted = true;
    (async () => {
      const result = await getOrderById(id);
      if (!mounted) return;
      if ('items' in result && Array.isArray(result.items)) {
        setOrder(result as PosOrderDetail);
        setError(null);
      } else {
        const err = result as { message?: string };
        setError(err.message ?? '無法載入訂單明細');
        setOrder(null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
        <div className="text-sm font-semibold text-slate-900">訂單明細</div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos/orders')}>
            返回列表
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos')}>
            收銀
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-4 shadow-sm shadow-slate-200">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">載入中…</div>
          ) : order ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">單號</span>
                <span className="font-medium text-slate-900">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">門市</span>
                <span className="text-slate-800">{order.storeId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">建立時間</span>
                <span className="text-slate-800">{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
              </div>
              <div className="pt-2">
                <div className="mb-1.5 font-medium text-slate-700">品項</div>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="py-1.5">商品 ID</th>
                      <th className="py-1.5 text-right">數量</th>
                      <th className="py-1.5 text-right">單價</th>
                      <th className="py-1.5 text-right">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-1.5 font-mono text-slate-600">{item.productId}</td>
                        <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-1.5 text-right tabular-nums">${item.unitPrice.toLocaleString()}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium">
                          ${(item.quantity * item.unitPrice).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                <span>應收金額</span>
                <span>${order.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
