import React, { useState } from 'react';
import { Button } from '../../shared/components/Button';
import { openSession } from '../../modules/pos/posSessionsApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

interface PosOpenSessionModalProps {
  storeId: string;
  storeName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PosOpenSessionModal: React.FC<PosOpenSessionModalProps> = ({
  storeId,
  storeName,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('5000');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n < 0) {
      setErr('請輸入有效起始現金金額（≥ 0）');
      return;
    }
    setSubmitting(true);
    setErr(null);
    const out = await openSession({ storeId, openingCashAmount: n });
    setSubmitting(false);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-content">開班</h2>
        {storeName && (
          <p className="mb-3 text-sm text-muted">{storeName}</p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted">起始現金金額（找零用）</label>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              data-testid="e2e-pos-open-amount"
              autoFocus
            />
          </div>
          {err && (
            <div className="mb-3 text-sm text-brand-danger">{err}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting} data-testid="e2e-pos-open-submit">
              {submitting ? '開班中…' : '開班'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
