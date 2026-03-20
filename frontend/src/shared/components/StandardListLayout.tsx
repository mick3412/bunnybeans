import React from 'react';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';

export const StandardListLayout: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  aboveContent?: React.ReactNode;
  loading?: boolean;
  error?: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  children?: React.ReactNode;
  maxWidthClassName?: string; // e.g. "max-w-6xl"
  testId?: string;
}> = ({
  title,
  description,
  actions,
  filters,
  aboveContent,
  loading,
  error,
  empty,
  emptyMessage = '尚無資料',
  emptyDescription,
  children,
  maxWidthClassName = 'max-w-6xl',
  testId,
}) => {
  return (
    <div
      className={`mx-auto w-full min-w-0 ${maxWidthClassName} rounded-2xl border border-brand-surface bg-white p-6 shadow-sm`}
      data-testid={testId}
    >
      <div className="border-b border-brand-surface pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-content">{title}</h2>
            {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {filters ? <div className="mt-4">{filters}</div> : null}
      </div>

      {aboveContent ? <div className="mt-4">{aboveContent}</div> : null}

      {error ? (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? <div className="mt-6 text-sm text-muted">載入中…</div> : null}

      {!loading && !error && empty ? (
        <EmptyState message={emptyMessage} description={emptyDescription} />
      ) : (
        <div className={filters ? 'mt-6' : 'mt-4'}>{children}</div>
      )}
    </div>
  );
};

