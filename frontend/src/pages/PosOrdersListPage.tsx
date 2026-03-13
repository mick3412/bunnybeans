import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../shared/components/Button';
import { listOrders } from '../modules/pos/posOrdersApi';
import type { PosOrderSummary } from '../modules/pos/posOrdersMockService';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

export const PosOrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<PosOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    const result = await listOrders({ page: pageNum, pageSize: PAGE_SIZE });
    if ('items' in result && Array.isArray(result.items)) {
      setOrders(result.items);
      setTotal(result.total);
      setPage(result.page);
    } else {
      const err = result as { message?: string };
      setError(err.message ?? '無法載入訂單列表');
      setOrders([]);
      setTotal(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
        <div>
          <div className="text-sm font-semibold text-slate-900">今日訂單</div>
          <div className="text-xs text-slate-500">共 {total} 筆</div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos')}>
          回到收銀畫面
        </Button>
      </header>

      <main className="flex-1 px-4 pb-4 pt-3">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-3 shadow-sm shadow-slate-200">
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">載入中…</div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">目前尚無訂單。</div>
          ) : (
            <>
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                    <th className="w-32 px-3 py-2">單號</th>
                    <th className="w-28 px-3 py-2">門市</th>
                    <th className="w-28 px-3 py-2 text-right">金額</th>
                    <th className="px-3 py-2">建立時間</th>
                    <th className="w-20 px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-900">{order.orderNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{order.storeId}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        ${order.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(order.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/pos/orders/${order.id}`)}
                        >
                          查看明細
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > PAGE_SIZE && (
                <div className="mt-2 flex items-center justify-center gap-2 text-[11px]">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一頁
                  </button>
                  <span>
                    {page} / {Math.ceil(total / PAGE_SIZE) || 1}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                    disabled={page >= Math.ceil(total / PAGE_SIZE)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一頁
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

