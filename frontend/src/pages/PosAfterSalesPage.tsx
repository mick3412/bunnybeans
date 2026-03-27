import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardListLayout } from '../shared/components/StandardListLayout';
import { Button } from '../shared/components/Button';
import { formatMoney } from '../shared/utils/formatMoney';
import { getErrorMessage } from '../shared/errors/errorMessages';
import {
  getPosFinanceEvents,
  getPosInventoryEvents,
  getPosReportsSummary,
  getStores,
  getWarehouses,
  listOrders,
  listReturns,
  type StoreDto,
  type PosReportsSummaryDto,
  type ReturnListItem,
} from '../modules/pos/posOrdersApi';
import type { PosOrderSummary } from '../modules/pos/posOrdersMockService';

type TabKey = 'all' | 'refund' | 'return' | 'exchange' | 'returns-record';

const REASON_LABEL: Record<string, string> = {
  SIZE_WRONG: '尺寸不合',
  DEFECTIVE: '瑕疵品',
  CHANGED_MIND: '改變心意',
  WRONG_ITEM: '拿錯商品',
  DUPLICATE_PURCHASE: '重複購買',
  OTHER: '其他',
};

const TYPE_LABEL: Record<string, string> = {
  FULL_RETURN: '全單退貨',
  PARTIAL_RETURN: '部分退貨',
  EXCHANGE: '換貨',
};

type AfterSalesRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  createdAt: string;
  type: TabKey;
  amount?: number;
  quantity?: number;
  customerName?: string | null;
};

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toIsoStart(ymd: string): string | undefined {
  return ymd ? `${ymd}T00:00:00.000Z` : undefined;
}

function toIsoEnd(ymd: string): string | undefined {
  return ymd ? `${ymd}T23:59:59.999Z` : undefined;
}

export const PosAfterSalesPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [storeId, setStoreId] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toYmd(d);
  });
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [tab, setTab] = useState<TabKey>('all');
  const [summary, setSummary] = useState<PosReportsSummaryDto | null>(null);
  const [refundRows, setRefundRows] = useState<AfterSalesRow[]>([]);
  const [returnRows, setReturnRows] = useState<AfterSalesRow[]>([]);
  const [exchangeRows, setExchangeRows] = useState<AfterSalesRow[]>([]);
  const [returnRecords, setReturnRecords] = useState<ReturnListItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const out = await getStores();
      if (!mounted) return;
      if (Array.isArray(out)) {
        setStores(out);
        if (out[0] && !storeId) setStoreId(out[0].id);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [storeId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const from = toIsoStart(fromDate);
      const to = toIsoEnd(toDate);

      const [sumRes, refundRes, exchangeRes, whRes] = await Promise.all([
        getPosReportsSummary({ from, to, storeId: storeId || undefined }),
        getPosFinanceEvents({ from, to, type: 'SALE_REFUND', page: 1, pageSize: 200 }),
        listOrders({
          page: 1,
          pageSize: 200,
          storeId: storeId || undefined,
          from,
          to,
          hasExchange: true,
        }),
        getWarehouses(),
      ]);

      if (!mounted) return;
      if ('statusCode' in sumRes) {
        setError(getErrorMessage(sumRes));
        setSummary(null);
      } else {
        setSummary(sumRes);
      }

      const refunds: AfterSalesRow[] = [];
      if ('items' in refundRes && Array.isArray(refundRes.items)) {
        refundRes.items.forEach((r) => {
          const oid = (r.referenceId ?? '').trim();
          refunds.push({
            id: r.id,
            orderId: oid || r.id,
            orderNumber: r.orderNumber?.trim() || '—',
            createdAt: r.occurredAt,
            type: 'refund',
            amount: Math.abs(r.amount),
          });
        });
      }
      setRefundRows(refunds);

      const exchanges: AfterSalesRow[] = [];
      if ('items' in exchangeRes && Array.isArray(exchangeRes.items)) {
        (exchangeRes.items as PosOrderSummary[]).forEach((o) => {
          exchanges.push({
            id: o.id,
            orderId: o.id,
            orderNumber: o.orderNumber,
            createdAt: o.createdAt,
            type: 'exchange',
            amount: o.totalAmount,
            customerName: o.customerName,
          });
        });
      }
      setExchangeRows(exchanges);

      const returns: AfterSalesRow[] = [];
      if (Array.isArray(whRes)) {
        const forStore = whRes.filter((w) => !storeId || w.storeId === storeId).map((w) => w.id);
        const invResults = await Promise.all(forStore.map((wid) => getPosInventoryEvents({ warehouseId: wid, page: 1, pageSize: 200 })));
        if (!mounted) return;
        invResults.forEach((inv) => {
          if ('items' in inv && Array.isArray(inv.items)) {
            inv.items
              .filter((ev) => ev.type === 'RETURN_FROM_CUSTOMER')
              .forEach((ev) => {
                const d = ev.occurredAt.slice(0, 10);
                if (fromDate && d < fromDate) return;
                if (toDate && d > toDate) return;
                returns.push({
                  id: ev.id,
                  orderId: ev.referenceId ?? ev.id,
                  orderNumber: ev.orderNumber?.trim() || '—',
                  createdAt: ev.occurredAt,
                  type: 'return',
                  quantity: Math.abs(ev.quantity),
                });
              });
          }
        });
      }
      setReturnRows(returns);

      const retRes = await listReturns({
        storeId: storeId || undefined,
        from,
        to,
        page: 1,
        pageSize: 200,
      });
      if (!mounted) return;
      if ('items' in retRes && Array.isArray(retRes.items)) {
        setReturnRecords(retRes.items);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [fromDate, toDate, storeId]);

  const rows = useMemo(() => {
    if (tab === 'returns-record') return [];
    if (tab === 'refund') return refundRows;
    if (tab === 'return') return returnRows;
    if (tab === 'exchange') return exchangeRows;
    return [...refundRows, ...returnRows, ...exchangeRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tab, refundRows, returnRows, exchangeRows]);

  const reasonStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of returnRecords) {
      if (r.topReason) m.set(r.topReason, (m.get(r.topReason) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([reason, count]) => ({ reason, label: REASON_LABEL[reason] ?? reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [returnRecords]);

  const todayReturnQty = useMemo(
    () => returnRows.filter((r) => r.createdAt.slice(0, 10) === toYmd(new Date())).reduce((s, r) => s + (r.quantity ?? 0), 0),
    [returnRows],
  );

  return (
    <StandardListLayout
      title="退換貨"
      description="退換貨與退款總覽"
      loading={loading}
      error={error ?? undefined}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="目前無退換貨資料"
      testId="e2e-pos-after-sales"
      filters={
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-xs">
              <div className="text-muted">今日退款金額／筆數</div>
              <div className="mt-1 font-semibold text-content">
                {formatMoney(summary?.refundsTotal ?? 0)} / {summary?.refundsCount ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-xs">
              <div className="text-muted">今日退貨件數</div>
              <div className="mt-1 font-semibold text-content">{todayReturnQty}</div>
            </div>
            <div className="rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-xs">
              <div className="text-muted">換貨筆數</div>
              <div className="mt-1 font-semibold text-content">{exchangeRows.length}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <select
              className="h-8 rounded-md border border-brand-surface bg-white px-2"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              <option value="">全部門市</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input type="date" className="h-8 rounded-md border border-brand-surface bg-white px-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" className="h-8 rounded-md border border-brand-surface bg-white px-2" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {([
          ['all', '全部'],
          ['refund', '退款'],
          ['return', '退貨'],
          ['exchange', '換貨'],
          ['returns-record', '退換貨記錄'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === k ? 'bg-brand-primary text-white' : 'bg-table-head text-content hover:bg-brand-surface'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'returns-record' ? (
        <>
          {reasonStats.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-3 md:grid-cols-4">
              {reasonStats.map((s) => (
                <div
                  key={s.reason}
                  className="rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-xs"
                >
                  <div className="text-muted">{s.label}</div>
                  <div className="mt-1 font-semibold text-content tabular-nums">
                    {s.count} 筆
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-brand-surface bg-white">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-brand-surface bg-table-head text-muted">
                <tr>
                  <th className="px-3 py-2">退貨單號</th>
                  <th className="px-3 py-2">原訂單</th>
                  <th className="px-3 py-2">類型</th>
                  <th className="px-3 py-2 text-right">退款金額</th>
                  <th className="px-3 py-2">退款方式</th>
                  <th className="px-3 py-2">主要原因</th>
                  <th className="px-3 py-2">時間</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {returnRecords.map((r) => (
                  <tr key={r.id} className="border-t border-brand-surface">
                    <td className="px-3 py-2 font-medium text-content">
                      {r.returnNumber}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {r.orderNumber?.trim() || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-table-head px-2 py-0.5 text-[11px] text-content">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-brand-danger">
                      {formatMoney(r.refundAmount)}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {r.refundMethod === 'CASH' ? '退現金' : '購物金'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {REASON_LABEL[r.topReason ?? ''] ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {new Date(r.createdAt).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          navigate(
                            `/pos/orders/${encodeURIComponent(r.orderId)}`,
                          )
                        }
                      >
                        查看訂單
                      </Button>
                    </td>
                  </tr>
                ))}
                {returnRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted">
                      無退換貨記錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-surface bg-white">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-brand-surface bg-table-head text-muted">
              <tr>
                <th className="px-3 py-2">訂單</th>
                <th className="px-3 py-2">時間</th>
                <th className="px-3 py-2">類型</th>
                <th className="px-3 py-2 text-right">金額/件數</th>
                <th className="px-3 py-2">客戶</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t border-brand-surface">
                  <td className="px-3 py-2 font-medium text-content">{r.orderNumber}</td>
                  <td className="px-3 py-2 text-muted">{new Date(r.createdAt).toLocaleString('zh-TW')}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-table-head px-2 py-0.5 text-[11px] text-content">
                      {r.type === 'refund' ? '退款' : r.type === 'return' ? '退貨' : '換貨'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {typeof r.amount === 'number' ? formatMoney(r.amount) : `${r.quantity ?? 0} 件`}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.customerName ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/pos/orders/${encodeURIComponent(r.orderId)}`)}
                    >
                      查看明細
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StandardListLayout>
  );
};
