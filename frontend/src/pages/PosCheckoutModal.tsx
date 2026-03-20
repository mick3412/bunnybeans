import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../shared/components/Button';
import { TextInput } from '../shared/components/TextInput';
import { getErrorMessage } from '../shared/errors/errorMessages';
import type { CartItem } from '../modules/pos/types';
import type { CreatePosOrderRequest } from '../modules/pos/posOrdersMockService';
import type { CreateOrderResult } from '../modules/pos/posOrdersApi';
import { createOrder } from '../modules/pos/posOrdersApi';
import { searchCustomers, type CustomerSearchItem } from '../modules/admin/loyaltyApi';
import { getCustomer } from '../modules/admin/adminApi';
import { Modal } from '../shared/components/Modal';

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
  /** 選填；有值時顯示會員搜尋（GET /customers/search）typeahead */
  merchantId?: string;
  onOrderCreated: (result: CreateOrderResult) => void;
  /** 選填；開啟時預填會員識別（如促銷試算已輸入的 UUID／手機／Email） */
  initialMemberInput?: string;
}

export const PosCheckoutModal: React.FC<PosCheckoutModalProps> = ({
  open,
  onClose,
  items,
  totalAmount,
  storeId,
  merchantId = '',
  onOrderCreated,
  initialMemberInput = '',
}) => {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [receivedAmount, setReceivedAmount] = useState<number>(totalAmount);
  const [memberInput, setMemberInput] = useState('');
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [memberSearchResults, setMemberSearchResults] = useState<CustomerSearchItem[]>([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorTraceId, setErrorTraceId] = useState<string | null>(null);
  const [pointBalance, setPointBalance] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setReceivedAmount(totalAmount);
      setMemberInput(initialMemberInput?.trim() ?? '');
      setPointsToRedeem(0);
      setMemberSearchResults([]);
      setPointBalance(null);
      setErrorMessage(null);
      setErrorCode(null);
      setErrorTraceId(null);
    }
  }, [open, totalAmount, initialMemberInput]);

  useEffect(() => {
    if (!parsed.customerId) {
      setPointBalance(null);
      return;
    }
    let cancelled = false;
    getCustomer(parsed.customerId).then((out) => {
      if (cancelled) return;
      if ('statusCode' in out) {
        setPointBalance(null);
        return;
      }
      setPointBalance(out.pointBalance ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [parsed.customerId]);

  const searchMembers = useCallback(async (q: string) => {
    if (!merchantId || !q.trim()) {
      setMemberSearchResults([]);
      return;
    }
    setMemberSearchLoading(true);
    const out = await searchCustomers(merchantId, q.trim());
    setMemberSearchLoading(false);
    if ('statusCode' in out) {
      setMemberSearchResults([]);
      return;
    }
    setMemberSearchResults(out.items ?? []);
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId || !memberInput.trim()) {
      setMemberSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchMembers(memberInput);
    }, 280);
    return () => clearTimeout(t);
  }, [merchantId, memberInput, searchMembers]);

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
    if (
      allowCredit &&
      !parsed.customerId &&
      !parsed.customerPhone &&
      !parsed.customerEmail
    ) {
      setErrorMessage(
        '掛帳須指定客戶：需要會員資訊。',
      );
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
        ...(pointsToRedeem > 0 ? { pointsToRedeem } : {}),
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
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="checkout-modal-title"
      className="z-30"
      panelClassName="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      dataTestId="e2e-checkout-modal"
    >
      <>
        <div className="mb-3 flex items-center justify-between">
          <h2 id="checkout-modal-title" className="text-sm font-semibold text-content">結帳</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-muted"
            disabled={submitting}
          >
            關閉
          </button>
        </div>

        <div className="mb-3 space-y-3 rounded-xl bg-table-head p-3 text-xs">
          <div className="border-b border-brand-surface pb-2">
            <div className="mb-1 text-[11px] font-semibold text-muted">關聯會員（選填）</div>
            <div className="relative">
              <TextInput
                label="會員識別"
                placeholder="UUID、手機或 Email（選填）"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                className="!py-1.5 !text-xs"
                data-testid="e2e-checkout-member"
              />
              {merchantId && memberSearchLoading && (
                <p className="absolute left-0 top-full mt-0.5 text-[10px] text-muted">搜尋中…</p>
              )}
              {merchantId && memberSearchResults.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-y-auto rounded border border-brand-surface bg-white shadow-lg">
                  {memberSearchResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left text-xs hover:bg-table-head"
                        onClick={() => {
                          setMemberInput(c.id);
                          setMemberSearchResults([]);
                        }}
                      >
                        {c.name}
                        {c.phone ? ` · ${c.phone}` : ''}
                        {c.memberCode ? ` (${c.memberCode})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {kindLabel && (
              <p className="mt-1 text-[10px] text-brand-primary">
                辨識為：<span className="font-medium">{kindLabel}</span>
              </p>
            )}
          </div>

          <div className="border-b border-brand-surface pb-2">
            <div className="mb-1 text-[11px] font-semibold text-muted">點數折抵</div>
            {pointBalance != null && (
              <p className="mb-1 text-[10px] text-muted">可用點數：{pointBalance}</p>
            )}
            <input
              type="number"
              min={0}
              max={pointBalance ?? undefined}
              step={1}
              inputMode="numeric"
              className="w-24 rounded-lg border border-brand-surface bg-white px-2 py-1.5 text-right text-xs text-content focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              value={pointsToRedeem > 0 ? pointsToRedeem : ''}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                const n = v === '' ? 0 : Math.max(0, parseInt(v, 10) || 0);
                const cap = pointBalance != null ? Math.min(n, pointBalance) : n;
                setPointsToRedeem(cap);
              }}
              data-testid="e2e-checkout-points-redeem"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted">
              <span>應收金額</span>
              <span className="text-base font-semibold text-content">${totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">付款方式</span>
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
              <span className="text-muted">實收金額</span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="e2e-checkout-received"
                  className="w-32 rounded-lg border border-brand-surface bg-white px-2 py-1 text-right text-xs text-content focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  value={receivedAmount.toString()}
                  onChange={(e) => changeReceived(e.target.value)}
                />
                <Button type="button" size="sm" variant="secondary" onClick={fillReceivedWithTotal} disabled={submitting}>
                  同應收金額
                </Button>
              </div>
            </div>
            {!allowCredit && (
              <div className="flex items-center justify-between text-muted">
                <span>找零</span>
                <span className="font-semibold text-brand-success">${change.toLocaleString()}</span>
              </div>
            )}
            {allowCredit && (
              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                掛帳／部分收款：實收 ${paidInPayments.toLocaleString()}，未收 ${unpaidAmount.toLocaleString()}。需要會員資訊。
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
      </>
    </Modal>
  );
};
