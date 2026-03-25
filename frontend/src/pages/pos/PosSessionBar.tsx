import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import { formatMoney } from '../../shared/utils/formatMoney';
import {
  getCurrentSession,
  openSession,
  closeSession,
  type CashRegisterSessionDto,
  type SessionReportDto,
} from '../../modules/pos/posSessionsApi';
import { PosOpenSessionModal } from './PosOpenSessionModal';
import { PosCloseSessionModal } from './PosCloseSessionModal';
import { getErrorMessage } from '../../shared/errors/errorMessages';

interface PosSessionBarProps {
  storeId: string;
  storeName?: string;
  onSessionChange?: () => void;
  /** 與門市選擇器同一列呈現，不另佔區塊 */
  inline?: boolean;
}

export const PosSessionBar: React.FC<PosSessionBarProps> = ({
  storeId,
  storeName,
  onSessionChange,
  inline,
}) => {
  const [current, setCurrent] = useState<(CashRegisterSessionDto & { report: SessionReportDto }) | null | undefined>(
    undefined,
  );
  const [err, setErr] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setErr(null);
    const out = await getCurrentSession(storeId);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      setCurrent(null);
      return;
    }
    setCurrent(out ?? null);
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenSuccess = useCallback(() => {
    setOpenModal(false);
    void load();
    onSessionChange?.();
  }, [load, onSessionChange]);

  const handleCloseSuccess = useCallback(() => {
    setCloseModal(false);
    void load();
    onSessionChange?.();
  }, [load, onSessionChange]);

  if (!storeId || current === undefined) return null;

  return (
    <>
      <div
        className={`flex flex-wrap items-center gap-3 ${inline ? '' : 'mb-3 rounded-xl border border-brand-surface bg-table-head px-3 py-2'}`}
        data-testid="e2e-pos-session-bar"
      >
        {err && (
          <span className="text-xs text-brand-danger">{err}</span>
        )}
        <span className="text-xs text-muted">
          {current === null
            ? `${storeName ? `${storeName} ` : ''}尚無開班`
            : '班次進行中'}
        </span>
        {current?.report && (
          <>
            <span className="text-xs text-muted">
              起始 {formatMoney(String(current.report.openingCash))}
            </span>
            <span className="text-xs text-muted">
              應有現金 {formatMoney(String(current.report.expectedCash))}
            </span>
            <span className="text-xs text-muted">
              {current.report.ordersCount} 筆
            </span>
          </>
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setOpenModal(true)}
          disabled={current !== null}
          data-testid="e2e-pos-session-open-btn"
        >
          開班
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setCloseModal(true)}
          disabled={current === null}
          data-testid="e2e-pos-session-close-btn"
        >
          結班
        </Button>
      </div>

      {openModal && (
        <PosOpenSessionModal
          storeId={storeId}
          storeName={storeName}
          onClose={() => setOpenModal(false)}
          onSuccess={handleOpenSuccess}
        />
      )}
      {closeModal && current && (
        <PosCloseSessionModal
          session={current}
          onClose={() => setCloseModal(false)}
          onSuccess={handleCloseSuccess}
        />
      )}
    </>
  );
};
