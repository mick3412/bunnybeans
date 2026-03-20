import React, { useCallback, useEffect, useRef } from 'react';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** 內層卡片 className */
  panelClassName?: string;
  closeOnBackdrop?: boolean;
  /** 面板內標題元素 id（與子元件中 h2 等對應） */
  labelledBy?: string;
  /** 無 labelledBy 時使用（無障礙名稱） */
  ariaLabel?: string;
  /** 外層 overlay（E2E 等） */
  dataTestId?: string;
};

/**
 * 共用 Modal：overlay、ESC、role="dialog"、aria-modal、aria-labelledby／aria-label
 */
export function Modal({
  open,
  onClose,
  children,
  className = '',
  panelClassName = 'w-full max-w-md rounded-2xl border border-brand-surface bg-white p-4 shadow-xl',
  closeOnBackdrop = true,
  labelledBy,
  ariaLabel = '對話框',
  dataTestId,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 ${className}`}
      role="presentation"
      data-testid={dataTestId}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        className={panelClassName}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
