import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import {
  getOrderById,
  getProducts,
  getCategories,
  appendOrderPayment,
  postRefund,
  postReturnToStock,
} from '../modules/pos/posOrdersApi';
import { Alert } from '../shared/components/Alert';
import { EmptyState } from '../shared/components/EmptyState';
import { getErrorMessage } from '../shared/errors/errorMessages';
import type { PosOrderDetail } from '../modules/pos/posOrdersMockService';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: '現金',
  CARD: '刷卡',
  TRANSFER: '轉帳',
  EWALLET: '電子支付',
};

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

export const PosOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [order, setOrder] = useState<PosOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productMap, setProductMap] = useState<
    Record<string, { id: string; sku?: string; name?: string; categoryId?: string }>
  >({});
  const [categoryMap, setCategoryMap] = useState<Record<string, { id: string; name: string }>>({});
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [returnQtyByLine, setReturnQtyByLine] = useState<Record<string, string>>({});
  const [returnStockSubmitting, setReturnStockSubmitting] = useState(false);
  const [returnStockError, setReturnStockError] = useState<string | null>(null);
  const [returnStockOk, setReturnStockOk] = useState<string | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);

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
        const err = result as { message?: string; code?: string };
        setError(
          getErrorMessage({
            code: err.code,
            message: err.message ?? '無法載入訂單明細',
          }),
        );
        setOrder(null);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!order) return;
    let mounted = true;
    (async () => {
      const [productsRes, categoriesRes] = await Promise.all([getProducts(), getCategories()]);
      if (!mounted) return;
      if (Array.isArray(productsRes)) {
        const next: Record<string, { id: string; sku?: string; name?: string; categoryId?: string }> = {};
        for (const p of productsRes) {
          next[p.id] = { id: p.id, sku: p.sku, name: p.name, categoryId: p.categoryId };
        }
        setProductMap(next);
      }
      if (Array.isArray(categoriesRes)) {
        const next: Record<string, { id: string; name: string }> = {};
        for (const c of categoriesRes) {
          next[c.id] = { id: c.id, name: c.name };
        }
        setCategoryMap(next);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [order]);

  const { displayPaid, remainingAmount, credit, paymentMethodsText } = useMemo(() => {
    if (!order) {
      return {
        displayPaid: 0,
        remainingAmount: 0,
        credit: false,
        paymentMethodsText: '—',
      };
    }
    const payments = order.payments ?? [];
    const sumPay = payments.reduce((s, p) => s + p.amount, 0);
    const paid = typeof order.paidAmount === 'number' ? order.paidAmount : sumPay;
    const remaining =
      typeof order.remainingAmount === 'number'
        ? order.remainingAmount
        : Math.max(0, order.totalAmount - paid);
    const isCredit = typeof order.credit === 'boolean' ? order.credit : remaining > 0;
    const text =
      payments.length > 0
        ? payments.map((p) => `${paymentMethodLabel(p.method)} $${p.amount.toLocaleString()}`).join('、')
        : paid > 0
          ? '—'
          : '無紀錄';
    return {
      displayPaid: paid,
      remainingAmount: remaining,
      credit: isCredit,
      paymentMethodsText: text,
    };
  }, [order]);

  const customerIdDisplay = order?.customerId?.trim() || null;
  const customerNameDisplay = order?.customerName?.trim() || null;
  const customerCodeDisplay = order?.customerCode?.trim() || null;

  const handleAppendPayment = async () => {
    if (!id || !order || remainingAmount <= 0) return;
    const n = Number(payAmount.replace(/[^\d.]/g, ''));
    if (!n || n <= 0) {
      setPayError(getErrorMessage({ code: 'POS_PAYMENT_AMOUNT_INVALID' }));
      return;
    }
    if (n > remainingAmount + 0.01) {
      setPayError(getErrorMessage({ code: 'POS_PAYMENT_EXCEEDS_REMAINING' }));
      return;
    }
    setPaySubmitting(true);
    setPayError(null);
    const res = await appendOrderPayment(id, {
      method: payMethod,
      amount: n,
      occurredAt: new Date().toISOString(),
    });
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body) {
      setOrder(res.body);
      setPayAmount('');
    } else {
      setPayError(getErrorMessage({ code: res.code, message: res.message }));
    }
    setPaySubmitting(false);
  };

  const handleRefund = async () => {
    if (!id || !order || displayPaid < 0.01) return;
    const n = Number(refundAmount.replace(/[^\d.]/g, ''));
    if (!n || n <= 0) {
      setRefundError(getErrorMessage({ code: 'POS_PAYMENT_AMOUNT_INVALID' }));
      return;
    }
    if (n > displayPaid + 0.01) {
      setRefundError(getErrorMessage({ code: 'POS_REFUND_EXCEEDS_PAID' }));
      return;
    }
    setRefundSubmitting(true);
    setRefundError(null);
    const res = await postRefund(id, {
      amount: n,
      occurredAt: new Date().toISOString(),
      note: refundNote.trim() || undefined,
    });
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body) {
      setOrder(res.body);
      setRefundAmount('');
      setRefundNote('');
    } else {
      setRefundError(getErrorMessage({ code: res.code, message: res.message }));
    }
    setRefundSubmitting(false);
  };

  const handleReturnToStock = async () => {
    if (!id || !order) return;
    const items: { productId: string; quantity: number }[] = [];
    const byProduct: Record<string, number> = {};
    for (const line of order.items) {
      const raw = (returnQtyByLine[line.id] ?? '').trim();
      const n = parseInt(raw, 10);
      if (!n || n < 1) continue;
      if (n > line.quantity) {
        setReturnStockError(getErrorMessage({ code: 'POS_RETURN_EXCEEDS_SOLD' }));
        setReturnStockOk(null);
        return;
      }
      byProduct[line.productId] = (byProduct[line.productId] ?? 0) + n;
    }
    for (const line of order.items) {
      const q = byProduct[line.productId];
      if (q && !items.some((x) => x.productId === line.productId)) {
        items.push({ productId: line.productId, quantity: q });
      }
    }
    if (items.length === 0) {
      setReturnStockError(getErrorMessage({ code: 'POS_RETURN_ITEMS_EMPTY' }));
      setReturnStockOk(null);
      return;
    }
    setReturnStockSubmitting(true);
    setReturnStockError(null);
    setReturnStockOk(null);
    const res = await postReturnToStock(id, {
      items,
      occurredAt: new Date().toISOString(),
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = res.body as PosOrderDetail | undefined;
      if (body && Array.isArray(body.items)) {
        setOrder(body);
      } else {
        const reloaded = await getOrderById(id);
        if ('items' in reloaded && Array.isArray((reloaded as PosOrderDetail).items)) {
          setOrder(reloaded as PosOrderDetail);
        }
      }
      setReturnQtyByLine({});
      setReturnStockOk('已登記退貨入庫（庫存已加回）');
    } else {
      setReturnStockError(getErrorMessage({ code: res.code, message: res.message }));
    }
    setReturnStockSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-brand-surface pb-2">
        <h2 className="text-lg font-semibold text-content">訂單明細</h2>
        <div className="flex flex-wrap gap-2">
          {returnTo && (
            <Button type="button" size="sm" variant="secondary" onClick={() => navigate(returnTo)}>
              回到來源
            </Button>
          )}
          <Button type="button" size="sm" variant="primary" onClick={() => setExchangeOpen(true)}>
            換貨
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos/orders')}>
            返回列表
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos')}>
            收銀
          </Button>
        </div>
      </div>
      <div className="min-h-0">
        {exchangeOpen && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-content">換貨（MVP）</h2>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-brand-canvas"
                  onClick={() => setExchangeOpen(false)}
                >
                  關閉
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-brand-surface bg-table-head p-3">
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setExchangeOpen(false);
                        const el = document.getElementById('return-to-stock');
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      前往退貨入庫區塊
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-brand-surface bg-table-head p-3">
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="primary" onClick={() => navigate('/pos')}>
                      前往收銀
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos/orders')}>
                      保留稍後處理
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="w-full rounded-xl border border-brand-surface bg-white p-4">
          {error && (
            <Alert variant="error" className="mb-3">
              {error}
            </Alert>
          )}
          {loading ? (
            <div className="space-y-4 py-10">
              <div className="flex animate-pulse gap-3">
                <div className="h-4 w-24 rounded bg-brand-surface" />
                <div className="h-4 flex-1 rounded bg-brand-surface" />
              </div>
              <div className="h-20 rounded-lg bg-brand-surface/50" />
              <div className="h-32 rounded-lg bg-brand-surface/50" />
              <p className="text-center text-xs text-muted">載入中…</p>
            </div>
          ) : !order && !error ? (
            <EmptyState message="找不到此訂單或訂單已不存在" />
          ) : order ? (
            <div className="space-y-3 text-xs">
              {credit && (
                <div
                  className="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-3 shadow-sm sm:px-4"
                  role="alert"
                >
                  <div className="text-center text-[11px] font-bold uppercase tracking-wide text-amber-900">
                    賒帳單 · 尚有未收
                  </div>
                  <div
                    className="mt-1 text-center text-lg font-bold tabular-nums text-amber-950"
                    data-testid="e2e-detail-remaining"
                  >
                    未收 ${remainingAmount.toLocaleString()}
                  </div>
                </div>
              )}

              {(() => {
                const ex = order.exchange ?? null;
                const st = order.exchangeSettlement ?? null;
                const sourceOrderId = ex?.sourceOrderId ?? order.exchangeFromOrderId ?? null;
                const derivedOrderIds = ex?.derivedOrderIds ?? [];
                const visible = Boolean(sourceOrderId || derivedOrderIds.length);
                if (!visible) return null;
                const selfReturnTo = `${location.pathname}${location.search}`;
                const delta = st?.deltaAmount;
                const deltaText =
                  typeof delta === 'number' && Number.isFinite(delta)
                    ? delta === 0
                      ? '差額 $0'
                      : delta > 0
                        ? `需補款 $${Math.abs(delta).toLocaleString()}`
                        : `需退款 $${Math.abs(delta).toLocaleString()}`
                    : null;
                const refundStatus = st?.refundStatus;
                const topupStatus = st?.topupStatus;
                return (
                  <div className="rounded-lg border border-brand-surface bg-white px-3 py-2 sm:px-4">
                    <div className="text-[10px] font-semibold uppercase text-muted">換貨關聯</div>
                    {deltaText ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-table-head px-2 py-1 font-semibold text-content">{deltaText}</span>
                        {refundStatus ? (
                          <span className="rounded-full bg-table-head px-2 py-1 text-muted">
                            退款狀態：{refundStatus === 'REQUIRED' ? '需退款' : refundStatus === 'SETTLED' ? '已退款' : '不需'}
                          </span>
                        ) : null}
                        {topupStatus ? (
                          <span className="rounded-full bg-table-head px-2 py-1 text-muted">
                            補款狀態：{topupStatus === 'REQUIRED' ? '需補款' : topupStatus === 'SETTLED' ? '已補款' : '不需'}
                          </span>
                        ) : null}
                        {refundStatus === 'REQUIRED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const el = document.getElementById('refund');
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                          >
                            前往退款
                          </Button>
                        ) : null}
                        {topupStatus === 'REQUIRED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const el = document.getElementById('append-payment');
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                          >
                            前往補款
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      null
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="min-w-0 rounded-lg bg-table-head px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase text-muted">來源（原單）</div>
                        {sourceOrderId ? (
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[11px] text-content" title={sourceOrderId}>
                              {sourceOrderId}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const qs = new URLSearchParams();
                                qs.set('returnTo', selfReturnTo);
                                navigate(`/pos/orders/${encodeURIComponent(sourceOrderId)}?${qs.toString()}`);
                              }}
                            >
                              查看
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted">—</div>
                        )}
                      </div>
                      <div className="min-w-0 rounded-lg bg-table-head px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase text-muted">衍生（換貨單）</div>
                        {derivedOrderIds.length ? (
                          <div className="mt-1 space-y-1">
                            {derivedOrderIds.slice(0, 3).map((oid) => (
                              <div key={oid} className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-[11px] text-content" title={oid}>
                                  {oid}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    const qs = new URLSearchParams();
                                    qs.set('returnTo', selfReturnTo);
                                    navigate(`/pos/orders/${encodeURIComponent(oid)}?${qs.toString()}`);
                                  }}
                                >
                                  查看
                                </Button>
                              </div>
                            ))}
                            {derivedOrderIds.length > 3 ? (
                              <div className="text-[11px] text-muted">…尚有 {derivedOrderIds.length - 3} 筆</div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted">—</div>
                        )}
                      </div>
                    </div>
                    {returnTo ? <div className="mt-2 text-[11px] text-muted" aria-hidden="true" /> : null}
                  </div>
                );
              })()}

              <div className="rounded-lg border border-brand-surface bg-table-head/90 px-3 py-2 sm:px-4">
                <div className="text-[10px] font-semibold uppercase text-muted">消費者</div>
                <div className="mt-1 space-y-0.5 text-content">
                  <div>
                    <span className="text-muted">ID</span>{' '}
                    <span className="break-all font-mono text-[11px]">{customerIdDisplay ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted">姓名</span>{' '}
                    <span className="font-medium">{customerNameDisplay ?? '—'}</span>
                  </div>
                  {customerCodeDisplay && (
                    <div>
                      <span className="text-muted">代碼</span> {customerCodeDisplay}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between border-b border-brand-surface pb-2">
                <span className="text-muted">單號</span>
                <span className="font-medium text-content">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between border-b border-brand-surface pb-2">
                <span className="text-muted">門市</span>
                <span className="break-all text-right text-content">{order.storeId}</span>
              </div>
              <div className="flex justify-between border-b border-brand-surface pb-2">
                <span className="text-muted">建立時間</span>
                <span className="text-content">{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
              </div>
              {(typeof order.subtotalAmount === 'number' ||
                typeof order.discountAmount === 'number' ||
                order.promotionApplied != null) && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-brand-success">金額明細（促銷）</div>
                  {typeof order.subtotalAmount === 'number' && (
                    <div className="mt-1 flex justify-between text-muted">
                      <span>小計</span>
                      <span className="tabular-nums font-medium">${order.subtotalAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {typeof order.discountAmount === 'number' && order.discountAmount > 0 && (
                    <div className="flex justify-between text-[#28A745]">
                      <span>折讓</span>
                      <span className="tabular-nums">-${order.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {order.promotionApplied != null && (
                    <div className="mt-1 text-[10px] text-muted">
                      <span className="text-muted">套用促銷</span>{' '}
                      <span className="break-all font-mono">
                        {typeof order.promotionApplied === 'string'
                          ? order.promotionApplied
                          : JSON.stringify(order.promotionApplied)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {remainingAmount > 0 && (
                <div id="append-payment" className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2">
                  <div className="mb-2 text-[11px] font-semibold text-sky-900">補款</div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex gap-1">
                      {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayMethod(m)}
                          className={`rounded px-2 py-1 text-[10px] font-medium ${
                            payMethod === m ? 'bg-sky-600 text-white' : 'bg-white text-muted ring-1 ring-brand-surface'
                          }`}
                        >
                          {paymentMethodLabel(m)}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="金額"
                      data-testid="e2e-detail-pay-amount"
                      className="h-8 w-24 rounded border border-brand-surface px-2 text-right tabular-nums"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      data-testid="e2e-detail-append-payment"
                      disabled={paySubmitting}
                      onClick={() => void handleAppendPayment()}
                    >
                      {paySubmitting ? '送出…' : '確認補款'}
                    </Button>
                  </div>
                  {payError && <p className="mt-1 text-[11px] text-red-600">{payError}</p>}
                </div>
              )}

              {displayPaid >= 0.01 && (
                <div id="refund" className="rounded-lg border border-brand-surface bg-table-head px-3 py-2">
                  <div className="mb-1 text-[11px] font-semibold text-content">退款（沖帳）</div>
                  <p className="mb-2 text-[10px] text-muted">
                    已實收範圍內登記退款，不超過實收合計；全賒未收單不可退。
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="退款金額"
                      data-testid="e2e-detail-refund-amount"
                      className="h-8 w-24 rounded border border-brand-surface bg-white px-2 text-right tabular-nums"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="備註（選填）"
                      className="h-8 min-w-[120px] flex-1 rounded border border-brand-surface bg-white px-2 text-[11px]"
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={refundSubmitting}
                      data-testid="e2e-detail-refund-submit"
                      onClick={() => void handleRefund()}
                    >
                      {refundSubmitting ? '送出…' : '確認退款'}
                    </Button>
                  </div>
                  {refundError && <p className="mt-1 text-[11px] text-red-600">{refundError}</p>}
                </div>
              )}

              <div id="return-to-stock" className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <div className="mb-1 text-[11px] font-semibold text-brand-success">退貨入庫（實體回倉）</div>
                <p className="mb-2 text-[10px] text-brand-success">
                  依本單明細加回庫存（RETURN_FROM_CUSTOMER）；與退款分開；單筆不得超過該列銷量。
                </p>
                <div className="space-y-1.5">
                  {order.items.map((line, idx) => {
                    const meta = productMap[line.productId];
                    const label = meta?.name ?? line.productId.slice(0, 8);
                    return (
                      <div key={line.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="min-w-0 flex-1 truncate text-content">{label}</span>
                        <span className="text-brand-success">售 {line.quantity}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="入庫數"
                          data-testid={idx === 0 ? 'e2e-detail-return-qty' : undefined}
                          className="h-7 w-14 rounded border border-emerald-200 bg-white px-1 text-right tabular-nums"
                          value={returnQtyByLine[line.id] ?? ''}
                          onChange={(e) =>
                            setReturnQtyByLine((prev) => ({ ...prev, [line.id]: e.target.value }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={returnStockSubmitting}
                    data-testid="e2e-detail-return-submit"
                    onClick={() => void handleReturnToStock()}
                  >
                    {returnStockSubmitting ? '送出…' : '確認退貨入庫'}
                  </Button>
                </div>
                {returnStockOk && (
                  <p
                    className="mt-1 text-[11px] text-brand-success"
                    data-testid="e2e-detail-return-success"
                  >
                    {returnStockOk}
                  </p>
                )}
                {returnStockError && (
                  <p className="mt-1 text-[11px] text-red-600">{returnStockError}</p>
                )}
              </div>

              <div className="pt-2">
                <div className="mb-1.5 font-medium text-muted">品項</div>
                <div className="-mx-1 overflow-x-auto sm:mx-0">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-brand-surface text-[11px] text-muted">
                        <th className="py-1.5">分類</th>
                        <th className="py-1.5">品牌</th>
                        <th className="py-1.5">品名</th>
                        <th className="py-1.5">商品 ID</th>
                        <th className="py-1.5 text-right">數量</th>
                        <th className="py-1.5 text-right">單價</th>
                        <th className="py-1.5 text-right">小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-b border-brand-surface">
                          {(() => {
                            const meta = productMap[item.productId];
                            const category = meta?.categoryId ? categoryMap[meta.categoryId] : undefined;
                            const displayCategory = category?.name ?? '—';
                            const displayBrand = '—';
                            const displayName = meta?.name ?? '—';
                            const displayId = meta?.sku ?? item.productId;
                            return (
                              <>
                                <td className="py-1.5 text-muted">{displayCategory}</td>
                                <td className="py-1.5 text-muted">{displayBrand}</td>
                                <td className="py-1.5 text-content">{displayName}</td>
                                <td className="py-1.5 font-mono text-[11px] text-muted">{displayId}</td>
                              </>
                            );
                          })()}
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
              </div>
              <div className="space-y-2 border-t border-brand-surface pt-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>應收金額</span>
                  <span className="tabular-nums">${order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>實收合計</span>
                  <span className="tabular-nums">${displayPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted">
                  <span>未收餘額</span>
                  <span className="tabular-nums font-medium">${remainingAmount.toLocaleString()}</span>
                </div>
                {credit && (
                  <div className="rounded-lg bg-amber-50 px-2 py-1 text-center text-[11px] font-medium text-amber-800">
                    掛帳（尚有未收）
                  </div>
                )}
                <div className="flex justify-between border-t border-brand-surface pt-2 text-xs font-normal">
                  <span className="text-muted">收款方式</span>
                  <span className="max-w-[70%] text-right text-content">{paymentMethodsText}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
