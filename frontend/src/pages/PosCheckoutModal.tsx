import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../shared/components/Button';
import { TextInput } from '../shared/components/TextInput';
import { getErrorMessage } from '../shared/errors/errorMessages';
import type { CartItem } from '../modules/pos/types';
import type { CreatePosOrderRequest } from '../modules/pos/posOrdersMockService';
import type { CreateOrderResult } from '../modules/pos/posOrdersApi';
import { createOrder } from '../modules/pos/posOrdersApi';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** 單一欄位自動辨識：UUID → customerId；含 @ → email；8 位以上數字 → 手機；其餘依 @ 或當手機送後端 */
export function parseMemberLookup(raw: string): {
  customerId: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  kind: 'uuid' | 'email' | 'phone' | 'empty' | 'other';
} {
  const s = raw.trim();
  if (!s) {
    return { customerId: null, customerPhone: null, customerEmail: null, kind: 'empty' };
  }
  if (looksLikeUuid(s)) {
    return { customerId: s, customerPhone: null, customerEmail: null, kind: 'uuid' };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) {
    return { customerId: null, customerPhone: null, customerEmail: s, kind: 'email' };
  }
  const phoneNorm = s.replace(/[\s\-()]/g, '');
  if (/^\+?[0-9]{8,15}$/.test(phoneNorm)) {
    return { customerId: null, customerPhone: phoneNorm, customerEmail: null, kind: 'phone' };
  }
  if (s.includes('@')) {
    return { customerId: null, customerPhone: null, customerEmail: s, kind: 'email' };
  }
  return { customerId: null, customerPhone: s, customerEmail: null, kind: 'other' };
}

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
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(totalAmount);
  const [memberInput, setMemberInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorTraceId, setErrorTraceId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReceivedAmount(totalAmount);
      setMemberInput('');
      setErrorMessage(null);
      setErrorCode(null);
      setErrorTraceId(null);
    }
  }, [open, totalAmount]);

  const parsed = useMemo(() => parseMemberLookup(memberInput), [memberInput]);
  const kindLabel =
    parsed.kind === 'empty'
      ? null
      : parsed.kind === 'uuid'
        ? '會員 ID（UUID）'
        : parsed.kind === 'email'
          ? 'Email'
          : parsed.kind === 'phone'
            ? '手機號碼'
            : '手機（將傳給後端辨識）';

  if (!open) return null;

  const changeReceived = (value: string) => {
    const n = Number(value.replace(/[^\d]/g, ''));
    if (Number.isNaN(n)) return;
    setReceivedAmount(n);
  };

  const fillReceivedWithTotal = () => setReceivedAmount(totalAmount);

  const allowCredit = receivedAmount < totalAmount;
  const paidInPayments = allowCredit ? receivedAmount : totalAmount;
  const change = Math.max(0, receivedAmount - totalAmount);
  const unpaidAmount = Math.max(0, totalAmount - receivedAmount);

  const handleSubmit = async () => {
    if (!storeId) return;

    if (receivedAmount > totalAmount) {
      setErrorMessage(getErrorMessage({ code: 'POS_PAYMENT_EXCEEDS_TOTAL' }));
      setErrorCode('POS_PAYMENT_EXCEEDS_TOTAL');
      return;
    }
    if (allowCredit && !parsed.customerId) {
      setErrorMessage('掛帳須指定客戶：請在同一欄輸入會員 ID（UUID）。僅手機或 Email 時請改全額結帳或聯繫後端支援。');
      setErrorCode('POS_CREDIT_REQUIRES_CUSTOMER');
      return;
    }
    if (paidInPayments < 0) {
      setErrorMessage(getErrorMessage({ code: 'POS_PAYMENT_AMOUNT_INVALID' }));
      setErrorCode('POS_PAYMENT_AMOUNT_INVALID');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTraceId(null);
    try {
      const now = new Date();
      const payments =
        paidInPayments > 0 ? [{ method, amount: paidInPayments }] : allowCredit ? [] : [{ method, amount: totalAmount }];

      if (!allowCredit && payments.length && payments[0].amount !== totalAmount) {
        setErrorMessage(getErrorMessage({ code: 'POS_PAYMENT_MISMATCH' }));
        setErrorCode('POS_PAYMENT_MISMATCH');
        setSubmitting(false);
        return;
      }

      const customerIdForApi = allowCredit ? parsed.customerId : parsed.customerId;

      const payload: CreatePosOrderRequest = {
        storeId,
        occurredAt: now.toISOString(),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: allowCredit && paidInPayments === 0 ? [] : payments,
        customerId: customerIdForApi,
        customerPhone: parsed.customerPhone,
        customerEmail: parsed.customerEmail,
        allowCredit: allowCredit || undefined,
      };

      const result = await createOrder(payload);
      onOrderCreated(result);
      if (result.statusCode >= 200 && result.statusCode < 300) {
        onClose();
      } else {
        setErrorMessage(
          getErrorMessage({
            code: result.code,
            message: result.message || '結帳失敗，請稍後再試。',
          }),
        );
        if (result.code) setErrorCode(result.code);
        if (result.traceId) setErrorTraceId(result.traceId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" data-testid="e2e-checkout-modal">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
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

        <div className="mb-3 space-y-3 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="border-b border-slate-200 pb-2">
            <div className="mb-1 text-[11px] font-semibold text-slate-700">關聯會員（選填）</div>
            <p className="mb-2 text-[10px] text-slate-500">
              同一欄可輸入會員 ID（UUID）、手機或 Email，系統會自動辨識。未填則不綁定。掛帳時請輸入 UUID。
            </p>
            <TextInput
              label="會員識別"
              placeholder="UUID、手機或 Email，選填"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              className="!py-1.5 !text-xs"
              data-testid="e2e-checkout-member"
            />
            {kindLabel && (
              <p className="mt-1 text-[10px] text-sky-700">
                辨識為：<span className="font-medium">{kindLabel}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span>應收金額</span>
              <span className="text-base font-semibold text-slate-900">${totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">付款方式</span>
              <div className="inline-flex flex-wrap gap-1">
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
                <Button
                  type="button"
                  size="sm"
                  variant={method === 'TRANSFER' ? 'primary' : 'secondary'}
                  onClick={() => setMethod('TRANSFER')}
                >
                  轉帳
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">實收金額</span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="e2e-checkout-received"
                  className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-100"
                  value={receivedAmount.toString()}
                  onChange={(e) => changeReceived(e.target.value)}
                />
                <Button type="button" size="sm" variant="secondary" onClick={fillReceivedWithTotal} disabled={submitting}>
                  同應收金額
                </Button>
              </div>
            </div>
            {!allowCredit && (
              <div className="flex items-center justify-between text-slate-600">
                <span>找零</span>
                <span className="font-semibold text-emerald-700">${change.toLocaleString()}</span>
              </div>
            )}
            {allowCredit && (
              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                掛帳／部分收款：實收 ${paidInPayments.toLocaleString()}，未收 ${unpaidAmount.toLocaleString()}。請在上方輸入
                <strong> 會員 UUID</strong>。
              </div>
            )}
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <div>{errorMessage}</div>
            {(errorCode || errorTraceId) && (
              <div className="mt-1 break-all text-[10px] text-red-500">
                {errorCode ? `code: ${errorCode}` : null}
                {errorCode && errorTraceId ? ' · ' : null}
                {errorTraceId ? `traceId: ${errorTraceId}` : null}
              </div>
            )}
          </div>
        ) : null}

        <Button
          type="button"
          fullWidth
          variant="success"
          data-testid="e2e-checkout-submit"
          onClick={handleSubmit}
          disabled={submitting || !items.length || !storeId}
        >
          {submitting ? '送出中…' : '確認送出'}
        </Button>
      </div>
    </div>
  );
};
