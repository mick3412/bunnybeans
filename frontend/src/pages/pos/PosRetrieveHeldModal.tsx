import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../shared/components/Modal';
import { formatMoney } from '../../shared/utils/formatMoney';
import { listHeldCarts, retrieveHeldCart, type HeldCartDto } from '../../modules/pos/posHeldCartsApi';
import { getErrorMessage } from '../../shared/errors/errorMessages';

interface PosRetrieveHeldModalProps {
  open: boolean;
  storeId: string;
  onClose: () => void;
  onSelect: (items: { productId: string; name: string; unitPrice: number; quantity: number }[]) => void;
}

function formatHeldTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length >= 6 ? id.slice(-6) : id;
}

export const PosRetrieveHeldModal: React.FC<PosRetrieveHeldModalProps> = ({
  open,
  storeId,
  onClose,
  onSelect,
}) => {
  const [list, setList] = useState<HeldCartDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [retrievingId, setRetrievingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setErr(null);
    const out = await listHeldCarts(storeId);
    setLoading(false);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      setList([]);
      return;
    }
    setList(Array.isArray(out) ? out : []);
  }, [storeId]);

  useEffect(() => {
    if (open && storeId) void load();
  }, [open, storeId, load]);

  const handleSelect = async (row: HeldCartDto) => {
    setRetrievingId(row.id);
    setErr(null);
    const out = await retrieveHeldCart(row.id);
    setRetrievingId(null);
    if (out && typeof out === 'object' && 'statusCode' in out) {
      setErr(getErrorMessage(out));
      return;
    }
    if (out && 'items' in out) {
      onSelect(out.items);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="pos-retrieve-held-title"
      panelClassName="w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-2xl border border-brand-surface bg-white shadow-xl"
      dataTestId="e2e-pos-retrieve-held-modal"
    >
      <h2 id="pos-retrieve-held-title" className="border-b border-brand-surface px-4 py-3 text-lg font-semibold text-content">
        取單
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="py-8 text-center text-sm text-muted">載入中…</div>
        )}
        {!loading && list.length === 0 && (
          <div className="py-8 text-center text-sm text-muted" data-testid="e2e-pos-retrieve-empty">暫無掛單</div>
        )}
        {!loading && list.length > 0 && (
          <div className="space-y-2">
            {list.map((row) => (
              <button
                key={row.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-surface bg-table-head px-3 py-2 text-left text-sm transition-colors hover:border-brand-primary hover:bg-brand-primary/5 disabled:opacity-60"
                onClick={() => handleSelect(row)}
                disabled={!!retrievingId}
                data-testid={`e2e-pos-retrieve-held-row-${shortId(row.id)}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-content">#{shortId(row.id)}</span>
                    <span className="text-xs text-muted">{formatHeldTime(row.heldAt)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {row.items.length} 件 · {formatMoney(row.total)}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums font-medium text-content">
                  {formatMoney(row.total)}
                </span>
              </button>
            ))}
          </div>
        )}
        {err && (
          <div className="mt-2 text-sm text-brand-danger">{err}</div>
        )}
      </div>
      <div className="border-t border-brand-surface px-4 py-2">
        <button
          type="button"
          className="w-full rounded-lg border border-brand-surface px-3 py-2 text-sm hover:bg-table-head"
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </Modal>
  );
};
