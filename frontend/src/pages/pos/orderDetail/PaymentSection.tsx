import React from 'react';
import { Button } from '../../../shared/components/Button';

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: '現金',
  CARD: '刷卡',
  TRANSFER: '轉帳',
};

export const PaymentSection: React.FC<{
  visible: boolean;
  payMethod: 'CASH' | 'CARD' | 'TRANSFER';
  payAmount: string;
  paySubmitting: boolean;
  payError: string | null;
  onChangeMethod: (m: 'CASH' | 'CARD' | 'TRANSFER') => void;
  onChangeAmount: (v: string) => void;
  onSubmit: () => void;
}> = ({
  visible,
  payMethod,
  payAmount,
  paySubmitting,
  payError,
  onChangeMethod,
  onChangeAmount,
  onSubmit,
}) => {
  if (!visible) return null;
  return (
    <div id="append-payment" className="rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-3 py-2">
      <div className="mb-2 text-[11px] font-semibold text-content">補款</div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          {(['CASH', 'CARD', 'TRANSFER'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChangeMethod(m)}
              className={`rounded px-2 py-1 text-[10px] font-medium ${
                payMethod === m ? 'bg-brand-primary text-white' : 'bg-white text-muted ring-1 ring-brand-surface'
              }`}
            >
              {PAYMENT_METHOD_LABEL[m]}
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
          onChange={(e) => onChangeAmount(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="primary"
          data-testid="e2e-detail-append-payment"
          disabled={paySubmitting}
          onClick={onSubmit}
        >
          {paySubmitting ? '送出…' : '確認補款'}
        </Button>
      </div>
      {payError ? <p className="mt-1 text-[11px] text-brand-danger">{payError}</p> : null}
    </div>
  );
};
