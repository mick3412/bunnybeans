import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportClickAudit, resolveOpsReference } from '../../modules/admin/adminApi';

type Props = {
  referenceId: string | null | undefined;
  /** 顯示文字；不傳則預設顯示「訂單」 */
  label?: string;
  /** 當無法辨識或不可穿透時顯示 */
  fallback?: React.ReactNode;
  /** 可選：外部 toast（避免每頁重複處理 unknown） */
  onUnknown?: (message: string) => void;
  /** 選配：從報表/列表穿透時，帶回退 URL（前端導引，不影響後端） */
  returnTo?: string;
  /** 來源頁（用於 click-audit）；例：admin-reports、loyalty-point-ledger */
  auditSource?: string;
  /** 欄位/位置（用於 click-audit）；例：referenceId */
  auditField?: string;
  /** 若要新分頁：由呼叫端決定用 Link；此元件統一用 navigate */
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(s: string | null | undefined): boolean {
  return Boolean(s && typeof s === 'string' && UUID_RE.test(s.trim()));
}

/**
 * referenceId 穿透共用元件（最小版）
 * - 目前：UUID → /pos/orders/:id
 * - 之後：可在此擴充呼叫 resolve API（/ops/references/resolve）再導向不同 kind
 */
export const ReferenceIdLink: React.FC<Props> = ({
  referenceId,
  label = '訂單',
  fallback = '—',
  onUnknown,
  returnTo,
  auditSource,
  auditField,
}) => {
  const navigate = useNavigate();
  const ref = referenceId?.trim() ?? '';
  const uuidLike = isUuidLike(ref);
  const [kind, setKind] = useState<'posOrder' | 'receivingNote' | 'unknown' | 'loading'>('loading');

  useEffect(() => {
    if (!uuidLike) {
      setKind('unknown');
      return;
    }
    let cancelled = false;
    (async () => {
      const resolved = await resolveOpsReference(ref);
      if (cancelled) return;
      if (resolved && typeof resolved === 'object' && 'statusCode' in resolved) {
        setKind('unknown');
        return;
      }
      const r = resolved as { kind?: 'posOrder' | 'receivingNote' | 'unknown' };
      setKind(r.kind ?? 'unknown');
    })();
    return () => {
      cancelled = true;
    };
  }, [ref, uuidLike]);

  const clickable = useMemo(() => kind === 'posOrder' || kind === 'receivingNote', [kind]);

  const onClick = useCallback(() => {
    void (async () => {
      // 上報（不阻塞導頁；失敗也不打斷使用者）
      const source = (auditSource ?? '').trim();
      if (source && uuidLike) {
        const field = (auditField ?? '').trim() || undefined;
        const resultCode = clickable ? 'NAVIGATED' : 'NOT_FOUND';
        await reportClickAudit({
          source,
          field,
          referenceId: ref,
          resultCode,
        }).catch(() => null);
      }
    })();

    if (!clickable) {
      onUnknown?.('無法辨識單據');
      return;
    }
    if (kind === 'posOrder') {
      const qs = new URLSearchParams();
      if (returnTo?.trim()) qs.set('returnTo', returnTo.trim());
      navigate(`/pos/orders/${encodeURIComponent(ref)}${qs.toString() ? `?${qs.toString()}` : ''}`);
      return;
    }
    if (kind === 'receivingNote') {
      navigate(`/admin/receiving-notes?id=${encodeURIComponent(ref)}`);
      return;
    }
    onUnknown?.('無法辨識單據');
  }, [auditField, auditSource, clickable, kind, navigate, onUnknown, ref, returnTo, uuidLike]);

  if (!uuidLike) return <>{fallback}</>;
  if (kind === 'loading') return <span className="text-xs text-muted">{fallback}</span>;
  if (!clickable) return <>{fallback}</>;

  return (
    <button
      type="button"
      className="text-xs font-medium text-sky-700 hover:underline"
      onClick={onClick}
      title={ref}
    >
      {label}
    </button>
  );
};

