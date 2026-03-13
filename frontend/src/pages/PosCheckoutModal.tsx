import React, { useState } from 'react';
import { Button } from '../shared/components/Button';
import type { CartItem } from '../modules/pos/types';
import type { CreatePosOrderRequest } from '../modules/pos/posOrdersMockService';
import type { CreateOrderResult } from '../modules/pos/posOrdersApi';
import { createOrder } from '../modules/pos/posOrdersApi';

/** 預留：後端補上 code 後可對應友善文案 */
const ERROR_CODE_MAP: Record<string, string> = {
  // INVENTORY_INSUFFICIENT: '庫存不足',
  // STORE_NOT_FOUND: '門市不存在',
};

interface PosCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalAmount: number;
  storeId: string;
  onOrderCreated: (result: CreateOrderResult) => void;
}

export const PosCheckoutModal: React.FC<PosCheckoutModalProps> = ({
  open,
  onClose,
  items,
  totalAmount,
  storeId,
  onOrderCreated,
}) => {
  const [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(totalAmount);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorTraceId, setErrorTraceId] = useState<string | null>(null);

  if (!open) return null;

  const changeReceived = (value: string) => {
    const parsed = Number(value.replace(/[^\d]/g, ''));
    if (Number.isNaN(parsed)) return;
    setReceivedAmount(parsed);
  };

  const fillReceivedWithTotal = () => {
    setReceivedAmount(totalAmount);
  };

  const handleSubmit = async () => {
    if (!storeId) return;
    setSubmitting(true);
    setErrorMessage(null);
    setErrorTraceId(null);
    try {
      const now = new Date();
      const payload: CreatePosOrderRequest = {
        storeId,
        occurredAt: now.toISOString(),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: [{ method, amount: totalAmount }],
        customerId: null,
      };
      const result = await createOrder(payload);
      onOrderCreated(result);
      if (result.statusCode >= 200 && result.statusCode < 300) {
        onClose();
      } else {
        setErrorMessage(result.message || '結帳失敗，請稍後再試。');
        if (result.traceId) setErrorTraceId(result.traceId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const change = Math.max(0, receivedAmount - totalAmount);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">結帳</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600"
            disabled={submitting}
          >
            關閉
          </button>
        </div>

        <div className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>應收金額</span>
            <span className="text-base font-semibold text-slate-900">${totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">付款方式</span>
            <div className="inline-flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={method === 'CASH' ? 'primary' : 'secondary'}
                onClick={() => setMethod('CASH')}
              >
                現金
              </Button>
              <Button
                type="button"
                size="sm"
                variant={method === 'CARD' ? 'primary' : 'secondary'}
                onClick={() => setMethod('CARD')}
              >
                刷卡
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">實收金額</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-100"
                value={receivedAmount.toString()}
                onChange={(e) => changeReceived(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={fillReceivedWithTotal}
                disabled={submitting}
              >
                同應收金額
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>找零</span>
            <span className="font-semibold text-emerald-700">${change.toLocaleString()}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <div>{errorMessage}</div>
            {errorTraceId && <div className="mt-1 text-[10px] text-red-500">traceId: {errorTraceId}</div>}
          </div>
        ) : null}

        <Button type="button" fullWidth variant="success" onClick={handleSubmit} disabled={submitting || !items.length || !storeId}>
          {submitting ? '送出中…' : '確認送出'}
        </Button>
      </div>
    </div>
  );
};

