import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../shared/components/Button';
import { listOrders, getStores } from '../modules/pos/posOrdersApi';
import { getErrorMessage } from '../shared/errors/errorMessages';
import type { PosOrderSummary } from '../modules/pos/posOrdersMockService';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

function customerLabel(o: PosOrderSummary): string {
  const name = o.customerName?.trim();
  if (name) return name;
  return '—';
}

export const PosOrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<PosOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTraceId, setErrorTraceId] = useState<string | null>(null);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeIdFilter, setStoreIdFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const navigate = useNavigate();

  const load = useCallback(
    async (pageNum: number, opts?: { resetPage?: boolean }) => {
      setLoading(true);
      setError(null);
      setErrorTraceId(null);
      const result = await listOrders({
        page: opts?.resetPage ? 1 : pageNum,
        pageSize: PAGE_SIZE,
        storeId: storeIdFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      if ('items' in result && Array.isArray(result.items)) {
        setOrders(result.items);
        setTotal(result.total);
        setPage(result.page);
      } else {
        const err = result as { message?: string; code?: string; traceId?: string };
        setError(
          getErrorMessage({
            code: err.code,
            message: err.message ?? '無法載入訂單列表',
          }),
        );
        const traceId = (result as { traceId?: string }).traceId;
        if (traceId) setErrorTraceId(traceId);
        setOrders([]);
        setTotal(0);
      }
      setLoading(false);
    },
    [fromDate, storeIdFilter, toDate],
  );

  useEffect(() => {
    (async () => {
      const storesRes = await getStores();
      if (Array.isArray(storesRes)) {
        setStores(storesRes.map((s) => ({ id: s.id, name: s.name })));
      }
      load(1, { resetPage: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur sm:px-6">
        <div>
          <div className="text-sm font-semibold text-slate-900">今日訂單</div>
          <div className="text-xs text-slate-500">共 {total} 筆</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="e2e-nav-pos"
            onClick={() => navigate('/pos')}
          >
            回到收銀畫面
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="e2e-nav-admin-inventory"
            onClick={() => navigate('/admin/inventory')}
            className="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
          >
            庫存（後台）
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-3 pb-4 pt-3 sm:px-4">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-3 shadow-sm shadow-slate-200 sm:p-4">
          <div className="mb-2 flex flex-wrap items-end gap-2 text-[11px]">
            <div className="flex min-w-[120px] flex-col">
              <label className="mb-0.5 text-slate-500">門市</label>
              <select
                className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                value={storeIdFilter}
                onChange={(e) => setStoreIdFilter(e.target.value)}
              >
                <option value="">全部</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-0.5 text-slate-500">起日</label>
              <input
                type="date"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-0.5 text-slate-500">迄日</label>
              <input
                type="date"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="secondary" onClick={() => load(1, { resetPage: true })}>
                套用篩選
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStoreIdFilter('');
                  setFromDate('');
                  setToDate('');
                  load(1, { resetPage: true });
                }}
              >
                清除
              </Button>
            </div>
          </div>
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
              <div>{error}</div>
              {errorTraceId && (
                <div className="mt-1 break-all text-[10px] text-red-500">traceId: {errorTraceId}</div>
              )}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">載入中…</div>
          ) : orders.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">目前尚無訂單。</div>
          ) : (
            <>
              {/* 小螢幕：卡片 */}
              <ul className="space-y-2 md:hidden">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900">{order.orderNumber}</div>
                        <div className="mt-1 text-slate-500">
                          客戶：<span className="text-slate-800">{customerLabel(order)}</span>
                        </div>
                        <div className="text-slate-500">
                          {new Date(order.createdAt).toLocaleString('zh-TW', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-900">
                          ${order.totalAmount.toLocaleString()}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="mt-2"
                          onClick={() => navigate(`/pos/orders/${order.id}`)}
                        >
                          明細
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* 桌機：表格 */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                      <th className="w-28 px-2 py-2 lg:w-32">單號</th>
                      <th className="w-24 px-2 py-2">門市</th>
                      <th className="min-w-[72px] px-2 py-2">客戶</th>
                      <th className="w-24 px-2 py-2 text-right">金額</th>
                      <th className="px-2 py-2">時間</th>
                      <th className="w-20 px-2 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr
                        key={order.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        data-testid={idx === 0 ? 'e2e-orders-first-row' : undefined}
                      >
                        <td
                          className="truncate px-2 py-2 font-medium text-slate-900"
                          title={order.orderNumber}
                          data-testid={idx === 0 ? 'e2e-orders-first-order-number' : undefined}
                        >
                          {order.orderNumber}
                        </td>
                        <td className="truncate px-2 py-2 text-slate-600" title={order.storeId}>
                          {order.storeId}
                        </td>
                        <td className="truncate px-2 py-2 text-slate-700" title={customerLabel(order)}>
                          {customerLabel(order)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                          ${order.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-slate-500">
                          {new Date(order.createdAt).toLocaleTimeString('zh-TW', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            data-testid={idx === 0 ? 'e2e-orders-first-detail' : undefined}
                            onClick={() => navigate(`/pos/orders/${order.id}`)}
                          >
                            查看明細
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px]">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                    disabled={page <= 1 || loading}
                    onClick={() => {
                      const prev = page - 1;
                      setPage(prev);
                      void load(prev);
                    }}
                  >
                    上一頁
                  </button>
                  <span>
                    {page} / {Math.ceil(total / PAGE_SIZE) || 1}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                    disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
                    onClick={() => {
                      const next = page + 1;
                      setPage(next);
                      void load(next);
                    }}
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
