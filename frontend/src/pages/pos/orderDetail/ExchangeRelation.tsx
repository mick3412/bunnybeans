import React from 'react';
import { Button } from '../../../shared/components/Button';
import { formatMoney } from '../../../shared/utils/formatMoney';
import type { PosOrderDetail } from '../../../modules/pos/posOrdersMockService';

export const ExchangeRelation: React.FC<{
  order: PosOrderDetail;
  selfReturnTo: string;
  onOpenOrder: (orderId: string) => void;
  onJumpRefund: () => void;
  onJumpTopup: () => void;
}> = ({ order, selfReturnTo, onOpenOrder, onJumpRefund, onJumpTopup }) => {
  const ex = order.exchange ?? null;
  const st = order.exchangeSettlement ?? null;
  const sourceOrderId = ex?.sourceOrderId ?? order.exchangeFromOrderId ?? null;
  const derivedOrderIds = ex?.derivedOrderIds ?? [];
  const visible = Boolean(sourceOrderId || derivedOrderIds.length);
  if (!visible) return null;

  const delta = st?.deltaAmount;
  const deltaText =
    typeof delta === 'number' && Number.isFinite(delta)
      ? delta === 0
        ? '差額 $0'
        : delta > 0
          ? `需補款 ${formatMoney(Math.abs(delta))}`
          : `需退款 ${formatMoney(Math.abs(delta))}`
      : null;

  return (
    <div className="rounded-lg border border-brand-surface bg-white px-3 py-2 sm:px-4">
      <div className="text-[10px] font-semibold uppercase text-muted">換貨關聯</div>
      {deltaText ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-table-head px-2 py-1 font-semibold text-content">{deltaText}</span>
          {st?.refundStatus ? (
            <span className="rounded-full bg-table-head px-2 py-1 text-muted">
              退款狀態：{st.refundStatus === 'REQUIRED' ? '需退款' : st.refundStatus === 'SETTLED' ? '已退款' : '不需'}
            </span>
          ) : null}
          {st?.topupStatus ? (
            <span className="rounded-full bg-table-head px-2 py-1 text-muted">
              補款狀態：{st.topupStatus === 'REQUIRED' ? '需補款' : st.topupStatus === 'SETTLED' ? '已補款' : '不需'}
            </span>
          ) : null}
          {st?.refundStatus === 'REQUIRED' ? (
            <Button type="button" size="sm" variant="secondary" onClick={onJumpRefund}>
              前往退款
            </Button>
          ) : null}
          {st?.topupStatus === 'REQUIRED' ? (
            <Button type="button" size="sm" variant="secondary" onClick={onJumpTopup}>
              前往補款
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-table-head px-3 py-2">
          <div className="text-[10px] font-semibold uppercase text-muted">來源（原單）</div>
          {sourceOrderId ? (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] text-content" title={sourceOrderId}>
                {sourceOrderId}
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => onOpenOrder(sourceOrderId)}>
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
                  <Button type="button" size="sm" variant="secondary" onClick={() => onOpenOrder(oid)}>
                    查看
                  </Button>
                </div>
              ))}
              {derivedOrderIds.length > 3 ? <div className="text-[11px] text-muted">…尚有 {derivedOrderIds.length - 3} 筆</div> : null}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted">—</div>
          )}
        </div>
      </div>
      <div className="sr-only">{selfReturnTo}</div>
    </div>
  );
};
