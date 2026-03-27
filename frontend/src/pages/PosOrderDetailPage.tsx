import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { formatMoney } from '../shared/utils/formatMoney';
import type { PosOrderDetail } from '../modules/pos/posOrdersMockService';
import { OrderHeader } from './pos/orderDetail/OrderHeader';
import { OrderContent } from './pos/orderDetail/OrderContent';
import { PaymentSection } from './pos/orderDetail/PaymentSection';
import { AfterSalesPanel } from './pos/orderDetail/AfterSalesPanel';

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
  const [afterSalesTab, setAfterSalesTab] = useState<'refund' | 'return' | 'exchange'>('refund');

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
        ? payments.map((p) => `${paymentMethodLabel(p.method)} ${formatMoney(p.amount)}`).join('、')
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

  const orderCtx = order
    ? {
        order,
        returnTo,
        customerIdDisplay,
        customerNameDisplay,
        customerCodeDisplay,
        computed: { displayPaid, remainingAmount, credit, paymentMethodsText },
        productMap,
        categoryMap,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl rounded-2xl border border-brand-surface bg-white p-6 shadow-sm">
      <OrderHeader
        returnTo={returnTo}
        onBackToSource={() => (returnTo ? navigate(returnTo) : undefined)}
        onBackToOrders={() => navigate('/pos/orders')}
        onBackToPos={() => navigate('/pos')}
      />
      <div className="min-h-0">
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
          ) : order && orderCtx ? (
            <div className="space-y-4">
              <OrderContent ctx={orderCtx} />
              <PaymentSection
                visible={remainingAmount > 0}
                payMethod={payMethod}
                payAmount={payAmount}
                paySubmitting={paySubmitting}
                payError={payError}
                onChangeMethod={(m) => setPayMethod(m)}
                onChangeAmount={(v) => setPayAmount(v)}
                onSubmit={() => void handleAppendPayment()}
              />
              <AfterSalesPanel
                order={order}
                tab={afterSalesTab}
                setTab={setAfterSalesTab}
                displayPaid={displayPaid}
                refundAmount={refundAmount}
                refundNote={refundNote}
                refundSubmitting={refundSubmitting}
                refundError={refundError}
                onRefundAmount={(v) => setRefundAmount(v)}
                onRefundNote={(v) => setRefundNote(v)}
                onRefundSubmit={() => void handleRefund()}
                returnQtyByLine={returnQtyByLine}
                returnStockSubmitting={returnStockSubmitting}
                returnStockError={returnStockError}
                returnStockOk={returnStockOk}
                onReturnQtyChange={(lineId, v) =>
                  setReturnQtyByLine((prev) => ({ ...prev, [lineId]: v }))
                }
                onReturnSubmit={() => void handleReturnToStock()}
                onGoPos={() => navigate('/pos')}
                productMap={productMap}
                onOrderUpdate={(updated) => setOrder(updated)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
