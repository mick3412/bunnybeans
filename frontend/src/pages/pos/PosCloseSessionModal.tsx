import React, { useState, useMemo } from 'react';
import { Button } from '../../shared/components/Button';
import { formatMoney } from '../../shared/utils/formatMoney';
import { closeSession } from '../../modules/pos/posSessionsApi';
import type { CashRegisterSessionDto, SessionReportDto } from '../../modules/pos/posSessionsApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

interface PosCloseSessionModalProps {
  session: CashRegisterSessionDto & { report: SessionReportDto };
  onClose: () => void;
  onSuccess: () => void;
}

function getPaymentMethodLabel(m: string): string {
  const map: Record<string, string> = {
    CASH: '現金',
    CARD: '刷卡',
    TRANSFER: '轉帳',
    EWALLET: '電子支付',
  };
  return map[m] ?? m;
}

export const PosCloseSessionModal: React.FC<PosCloseSessionModalProps> = ({
  session,
  onClose,
  onSuccess,
}) => {
  const report = session.report;
  const expectedCash = report?.expectedCash ?? 0;
  const [actualAmount, setActualAmount] = useState(String(expectedCash));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const difference = useMemo(() => {
    const n = parseFloat(actualAmount);
    if (Number.isNaN(n)) return null;
    return n - expectedCash;
  }, [actualAmount, expectedCash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(actualAmount);
    if (Number.isNaN(n) || n < 0) {
      setErr('請輸入有效實際點交金額（≥ 0）');
      return;
    }
    setSubmitting(true);
    setErr(null);
    const out = await closeSession(session.id, { actualCashAmount: n });
    setSubmitting(false);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-content">結班</h2>

        <div className="mb-4 space-y-1 rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">起始現金</span>
            <span className="tabular-nums">{report ? formatMoney(String(report.openingCash)) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">現金銷售</span>
            <span className="tabular-nums">{report ? formatMoney(String(report.cashSales)) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">現金退款</span>
            <span className="tabular-nums">{report ? formatMoney(String(report.cashRefunds)) : '-'}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>應有現金</span>
            <span className="tabular-nums">{formatMoney(String(expectedCash))}</span>
          </div>
          {report?.byPaymentMethod && Object.keys(report.byPaymentMethod).length > 0 && (
            <div className="mt-2 border-t border-brand-surface pt-2">
              <div className="mb-1 text-xs text-muted">付款方式</div>
              {Object.entries(report.byPaymentMethod).map(([m, amt]) => (
                <div key={m} className="flex justify-between text-xs">
                  <span>{getPaymentMethodLabel(m)}</span>
                  <span className="tabular-nums">{formatMoney(String(amt))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted">實際點交金額</label>
            <input
              type="number"
              min="0"
              step="1"
              value={actualAmount}
              onChange={(e) => setActualAmount(e.target.value)}
              className="w-full rounded-xl border border-brand-surface bg-white px-3 py-2 text-sm tabular-nums focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              data-testid="e2e-pos-close-actual"
            />
          </div>
          {difference !== null && (
            <div className={`mb-3 text-sm ${difference === 0 ? 'text-muted' : difference > 0 ? 'text-brand-success' : 'text-brand-danger'}`}>
              差異：{difference >= 0 ? '+' : ''}{formatMoney(String(difference))}
            </div>
          )}
          {err && (
            <div className="mb-3 text-sm text-brand-danger">{err}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting} data-testid="e2e-pos-close-submit">
              {submitting ? '結班中…' : '確認結班'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
