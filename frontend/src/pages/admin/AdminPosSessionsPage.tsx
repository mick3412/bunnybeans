import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listSessions, getSessionById } from '../../modules/pos/posSessionsApi';
import type { CashRegisterSessionDto } from '../../modules/pos/posSessionsApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';
import { StandardListLayout } from '../../shared/components/StandardListLayout';
import { useDefaultMerchantId } from '../../shared/hooks/useDefaultMerchantId';
import { formatMoney } from '../../shared/utils/formatMoney';
import { listStores } from '../../modules/admin/api/merchantApi';

export const AdminPosSessionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const defaultMerchantId = useDefaultMerchantId();
  const merchantId = (searchParams.get('merchantId') ?? '').trim() || defaultMerchantId;
  const storeId = (searchParams.get('storeId') ?? '').trim() || undefined;
  const status = (searchParams.get('status') ?? '').trim() || undefined;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const from = (searchParams.get('from') ?? '').trim() || monthAgo;
  const to = (searchParams.get('to') ?? '').trim() || today;

  const [items, setItems] = useState<CashRegisterSessionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(CashRegisterSessionDto & { report?: { period: { from: string; to: string }; openingCash: number; cashSales: number; cashRefunds: number; expectedCash: number; actualCash?: number; difference?: number; byPaymentMethod?: Record<string, number>; ordersCount: number; refundsCount: number } }) | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const out = await listSessions({
      merchantId: merchantId || undefined,
      storeId,
      status,
      from,
      to,
      page: 1,
      pageSize: 50,
    });
    setLoading(false);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      setItems([]);
      setTotal(0);
      return;
    }
    if (out && 'items' in out) {
      setItems(out.items);
      setTotal(out.total);
    }
  }, [merchantId, storeId, status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await listStores();
      if (!mounted) return;
      if (Array.isArray(res)) {
        setStores(res.map((s) => ({ id: s.id, name: s.name })));
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetail(null);
    const out = await getSessionById(id);
    setDetailLoading(false);
    if (out && typeof out === 'object' && !('statusCode' in out)) {
      setDetail(out as typeof detail);
    }
  }, []);

  const description = useMemo(
    () => (
      <span>
        收銀班次列表，含開班／結班紀錄。資料來源 <code className="rounded bg-table-head px-1">GET /pos/sessions</code>。
      </span>
    ),
    [],
  );

  const storeNameMap = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);

  return (
    <StandardListLayout
      title="收銀班次"
      description={description}
      loading={loading}
      error={err}
      testId="e2e-admin-pos-sessions"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <a
          href={`/admin/pos/sessions?${new URLSearchParams({
            ...(merchantId && { merchantId }),
            ...(storeId && { storeId }),
            ...(status && { status }),
            ...(from && { from }),
            ...(to && { to }),
          }).toString()}`}
          className="text-sm text-brand-primary hover:underline"
        >
          重新整理
        </a>
        <span className="text-xs text-muted">共 {total} 筆</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-surface bg-white">
        <div className="border-b border-brand-surface bg-table-head px-4 py-3 text-sm font-semibold text-content">
          班次列表
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">載入中…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">尚無班次紀錄</div>
        ) : (
          <div className="table-sticky-head overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-surface bg-table-head text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">門市</th>
                  <th className="px-4 py-2">開班時間</th>
                  <th className="px-4 py-2">結班時間</th>
                  <th className="px-4 py-2">起始現金</th>
                  <th className="px-4 py-2">應有</th>
                  <th className="px-4 py-2">實際</th>
                  <th className="px-4 py-2">差異</th>
                  <th className="px-4 py-2">狀態</th>
                  <th className="px-4 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-brand-surface hover:bg-brand-canvas">
                    <td className="px-4 py-2">{row.storeName ?? storeNameMap.get(row.storeId) ?? row.storeId}</td>
                    <td className="px-4 py-2 text-muted">{row.openedAt?.slice(0, 19)}</td>
                    <td className="px-4 py-2 text-muted">{row.closedAt?.slice(0, 19) ?? '-'}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(String(row.openingCashAmount))}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {row.expectedCashAmount != null ? formatMoney(String(row.expectedCashAmount)) : '-'}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {row.actualCashAmount != null ? formatMoney(String(row.actualCashAmount)) : '-'}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {row.differenceAmount != null ? (
                        <span className={Number(row.differenceAmount) >= 0 ? 'text-brand-success' : 'text-brand-danger'}>
                          {Number(row.differenceAmount) >= 0 ? '+' : ''}{formatMoney(String(row.differenceAmount))}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="text-xs text-brand-primary hover:underline"
                        onClick={() => void loadDetail(row.id)}
                      >
                        詳情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && (
        <div className="mt-6 rounded-xl border border-brand-surface bg-table-head p-4">
          <h3 className="mb-3 text-sm font-semibold text-content">班次詳情</h3>
          {detailLoading ? (
            <div className="py-4 text-center text-sm text-muted">載入中…</div>
          ) : detail?.report ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">期間</span>
                <span>{detail.report.period?.from} ～ {detail.report.period?.to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">起始現金</span>
                <span className="tabular-nums">{formatMoney(String(detail.report.openingCash))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">現金銷售</span>
                <span className="tabular-nums">{formatMoney(String(detail.report.cashSales))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">現金退款</span>
                <span className="tabular-nums">{formatMoney(String(detail.report.cashRefunds))}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>應有現金</span>
                <span className="tabular-nums">{formatMoney(String(detail.report.expectedCash))}</span>
              </div>
              {detail.report.actualCash != null && (
                <div className="flex justify-between">
                  <span className="text-muted">實際點交</span>
                  <span className="tabular-nums">{formatMoney(String(detail.report.actualCash))}</span>
                </div>
              )}
              {detail.report.difference != null && (
                <div className="flex justify-between">
                  <span className="text-muted">差異</span>
                  <span className={`tabular-nums ${detail.report.difference >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
                    {detail.report.difference >= 0 ? '+' : ''}{formatMoney(String(detail.report.difference))}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">交易筆數</span>
                <span>{detail.report.ordersCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">退款筆數</span>
                <span>{detail.report.refundsCount}</span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-sm text-muted">無法載入詳情</div>
          )}
          <div className="mt-3">
            <button
              type="button"
              className="text-xs text-muted hover:underline"
              onClick={() => { setDetailId(null); setDetail(null); }}
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </StandardListLayout>
  );
};
