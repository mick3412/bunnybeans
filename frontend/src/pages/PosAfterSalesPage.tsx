import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardListLayout } from '../shared/components/StandardListLayout';
import { Button } from '../shared/components/Button';
import { formatMoney } from '../shared/utils/formatMoney';
import { getErrorMessage } from '../shared/errors/errorMessages';
import {
  getPosFinanceEvents,
  getPosReportsSummary,
  getStores,
  listOrders,
  listReturns,
  type StoreDto,
  type PosReportsSummaryDto,
} from '../modules/pos/posOrdersApi';
import type { PosOrderSummary } from '../modules/pos/posOrdersMockService';

type TabKey = 'all' | 'refund' | 'return' | 'exchange';

type AfterSalesRow = {
  id: string;
  sourceOrderId: string;
  sourceOrderNumber: string;
  returnOrderNumber: string;
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

      const [sumRes, refundRes, exchangeRes, retRes] = await Promise.all([
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
        listReturns({
          storeId: storeId || undefined,
          from,
          to,
          page: 1,
          pageSize: 200,
        }),
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
            sourceOrderId: oid || r.id,
            sourceOrderNumber: r.orderNumber?.trim() || '—',
            returnOrderNumber: '—',
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
            sourceOrderId: o.exchangeFromOrderId ?? o.id,
            sourceOrderNumber: o.exchangeFromOrderId
              ? `${o.exchangeFromOrderId.slice(0, 8)}…`
              : o.orderNumber,
            returnOrderNumber: o.orderNumber,
            createdAt: o.createdAt,
            type: 'exchange',
            amount: o.totalAmount,
            customerName: o.customerName,
          });
        });
      }
      setExchangeRows(exchanges);

      const returns: AfterSalesRow[] = [];
      if ('items' in retRes && Array.isArray(retRes.items)) {
        retRes.items.forEach((r) => {
          returns.push({
            id: r.id,
            sourceOrderId: r.orderId,
            sourceOrderNumber: r.orderNumber?.trim() || '—',
            returnOrderNumber: r.returnNumber,
            createdAt: r.createdAt,
            type: 'return',
            quantity: r.itemCount,
            amount: r.refundAmount,
          });
        });
      }
      setReturnRows(returns);

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [fromDate, toDate, storeId]);

  const rows = useMemo(() => {
    if (tab === 'refund') return refundRows;
    if (tab === 'return') return returnRows;
    if (tab === 'exchange') return exchangeRows;
    return [...refundRows, ...returnRows, ...exchangeRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tab, refundRows, returnRows, exchangeRows]);

  const todayReturnQty = useMemo(
    () => returnRows.filter((r) => r.createdAt.slice(0, 10) === toYmd(new Date())).reduce((s, r) => s + (r.quantity ?? 0), 0),
    [returnRows],
  );

  return (
    <StandardListLayout
      title="退換貨明細"
      description="退換貨與退款總覽"
      loading={loading}
      error={error ?? undefined}
      empty={!loading && !error && rows.length === 0}
      emptyMessage="目前無退換貨資料"
      emptyDescription="若為測試環境，請先建立訂單並完成至少一次退貨／退款，或重新執行 e2e:seed（full profile）。"
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
      <div className="overflow-x-auto rounded-xl border border-brand-surface bg-white">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="border-b border-brand-surface bg-table-head text-muted">
            <tr>
              <th className="px-3 py-2">原訂單</th>
              <th className="px-3 py-2">退換貨訂單</th>
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
                <td className="px-3 py-2 font-medium text-content">{r.sourceOrderNumber}</td>
                <td className="px-3 py-2 text-content">
                  {r.returnOrderNumber !== '—' && r.sourceOrderId ? (
                    <button
                      type="button"
                      className="font-medium text-brand-primary underline underline-offset-2"
                      onClick={() => navigate(`/pos/orders/${encodeURIComponent(r.sourceOrderId)}?returnId=${encodeURIComponent(r.id)}`)}
                    >
                      {r.returnOrderNumber}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
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
                    onClick={() => navigate(`/pos/orders/${encodeURIComponent(r.sourceOrderId)}`)}
                  >
                    查看明細
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StandardListLayout>
  );
};
