import React, { useCallback, useEffect } from 'react';

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  /** 標題文字；若需自訂 header 請用 header */
  title?: React.ReactNode;
  /** 自訂整個 header（含關閉鈕），覆蓋 title */
  header?: React.ReactNode;
  /** 無障礙：面板標題 id */
  labelledBy?: string;
  /** 無障礙：無 labelledBy 時用 */
  ariaLabel?: string;
  children: React.ReactNode;
  /** 面板寬度 class，預設 max-w-md */
  widthClassName?: string;
  /** 外層 data-testid */
  dataTestId?: string;
};

/**
 * 右側滑出 Drawer：overlay、ESC 關閉、role="dialog"、aria
 */
export function Drawer({
  open,
  onClose,
  title,
  header,
  labelledBy,
  ariaLabel = '側邊面板',
  children,
  widthClassName = 'w-full max-w-md',
  dataTestId,
}: DrawerProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" data-testid={dataTestId}>
      <div
        className="absolute inset-0 bg-black/25"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-brand-surface bg-white shadow-xl ${widthClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
      >
        {(header || title || labelledBy) && (
          <div className="flex shrink-0 items-center justify-between border-b border-brand-surface bg-table-head px-4 py-3">
            {header ? (
              header
            ) : (
              <>
                {typeof title === 'string' ? (
                  <h2 id={labelledBy} className="text-sm font-semibold text-content">
                    {title}
                  </h2>
                ) : title ? (
                  <div id={labelledBy}>{title}</div>
                ) : labelledBy ? (
                  <div id={labelledBy} />
                ) : null}
                <button
                  type="button"
                  className="rounded px-2 py-1 text-sm text-muted hover:bg-brand-canvas"
                  onClick={onClose}
                  aria-label="關閉"
                >
                  關閉
                </button>
              </>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
