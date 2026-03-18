import React from 'react';

/** 全站統一空狀態：主文案 + 可選說明，置中、次要文字色 */
export function EmptyState(props: { message: string; description?: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted">
      <p className="font-medium">{props.message}</p>
      {props.description && <p className="mt-1 text-xs">{props.description}</p>}
    </div>
  );
}
