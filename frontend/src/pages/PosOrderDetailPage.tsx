import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../shared/components/Button';
import {
  getOrderById,
  getProducts,
  getCategories,
  appendOrderPayment,
  postRefund,
  postReturnToStock,
} from '../modules/pos/posOrdersApi';
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
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur sm:px-6">
        <div className="text-sm font-semibold text-slate-900">訂單明細</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos/orders')}>
            返回列表
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/pos')}>
            收銀
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-3 pb-4 pt-3 sm:px-4">
        <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-3 shadow-sm shadow-slate-200 sm:p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">載入中…</div>
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

              <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 sm:px-4">
                <div className="text-[10px] font-semibold uppercase text-slate-500">消費者</div>
                <div className="mt-1 space-y-0.5 text-slate-800">
                  <div>
                    <span className="text-slate-500">ID</span>{' '}
                    <span className="break-all font-mono text-[11px]">{customerIdDisplay ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">姓名</span>{' '}
                    <span className="font-medium">{customerNameDisplay ?? '—'}</span>
                  </div>
                  {customerCodeDisplay && (
                    <div>
                      <span className="text-slate-500">代碼</span> {customerCodeDisplay}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">單號</span>
                <span className="font-medium text-slate-900">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">門市</span>
                <span className="break-all text-right text-slate-800">{order.storeId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">建立時間</span>
                <span className="text-slate-800">{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
              </div>

              {remainingAmount > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2">
                  <div className="mb-2 text-[11px] font-semibold text-sky-900">補款</div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex gap-1">
                      {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPayMethod(m)}
                          className={`rounded px-2 py-1 text-[10px] font-medium ${
                            payMethod === m ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
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
                      className="h-8 w-24 rounded border border-slate-200 px-2 text-right tabular-nums"
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
                <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2">
                  <div className="mb-1 text-[11px] font-semibold text-violet-900">退款（沖帳）</div>
                  <p className="mb-2 text-[10px] text-violet-800">
                    已實收範圍內登記退款，不超過實收合計；全賒未收單不可退。
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="退款金額"
                      data-testid="e2e-detail-refund-amount"
                      className="h-8 w-24 rounded border border-violet-200 bg-white px-2 text-right tabular-nums"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="備註（選填）"
                      className="h-8 min-w-[120px] flex-1 rounded border border-violet-200 bg-white px-2 text-[11px]"
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

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <div className="mb-1 text-[11px] font-semibold text-emerald-900">退貨入庫（實體回倉）</div>
                <p className="mb-2 text-[10px] text-emerald-800">
                  依本單明細加回庫存（RETURN_FROM_CUSTOMER）；與退款分開；單筆不得超過該列銷量。
                </p>
                <div className="space-y-1.5">
                  {order.items.map((line, idx) => {
                    const meta = productMap[line.productId];
                    const label = meta?.name ?? line.productId.slice(0, 8);
                    return (
                      <div key={line.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="min-w-0 flex-1 truncate text-emerald-950">{label}</span>
                        <span className="text-emerald-700">售 {line.quantity}</span>
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
                    className="mt-1 text-[11px] text-emerald-700"
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
                <div className="mb-1.5 font-medium text-slate-700">品項</div>
                <div className="-mx-1 overflow-x-auto sm:mx-0">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] text-slate-500">
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
                        <tr key={item.id} className="border-b border-slate-100">
                          {(() => {
                            const meta = productMap[item.productId];
                            const category = meta?.categoryId ? categoryMap[meta.categoryId] : undefined;
                            const displayCategory = category?.name ?? '—';
                            const displayBrand = '—';
                            const displayName = meta?.name ?? '—';
                            const displayId = meta?.sku ?? item.productId;
                            return (
                              <>
                                <td className="py-1.5 text-slate-600">{displayCategory}</td>
                                <td className="py-1.5 text-slate-600">{displayBrand}</td>
                                <td className="py-1.5 text-slate-800">{displayName}</td>
                                <td className="py-1.5 font-mono text-[11px] text-slate-500">{displayId}</td>
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
              <div className="space-y-2 border-t border-slate-200 pt-2 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>應收金額</span>
                  <span className="tabular-nums">${order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>實收合計</span>
                  <span className="tabular-nums">${displayPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span>未收餘額</span>
                  <span className="tabular-nums font-medium">${remainingAmount.toLocaleString()}</span>
                </div>
                {credit && (
                  <div className="rounded-lg bg-amber-50 px-2 py-1 text-center text-[11px] font-medium text-amber-800">
                    掛帳（尚有未收）
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-2 text-xs font-normal">
                  <span className="text-slate-500">收款方式</span>
                  <span className="max-w-[70%] text-right text-slate-800">{paymentMethodsText}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
