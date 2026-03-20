import React from 'react';

/** 全站統一錯誤／成功區塊 */
export function Alert(props: {
  variant: 'error' | 'success';
  children: React.ReactNode;
  className?: string;
}) {
  const isError = props.variant === 'error';
  const base = isError
    ? 'rounded-lg border border-brand-danger/30 bg-brand-danger/10 px-3 py-2 text-sm text-brand-danger'
    : 'rounded-lg border border-brand-success/30 bg-brand-success/10 px-3 py-2 text-sm text-brand-success';
  return (
    <div
      className={props.className ? `${base} ${props.className}`.trim() : base}
      role="alert"
    >
      {props.children}
    </div>
  );
}
