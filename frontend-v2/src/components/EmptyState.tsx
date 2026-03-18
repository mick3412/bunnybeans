import React from 'react';

type Props = { message?: string };

export const EmptyState: React.FC<Props> = ({ message = '尚無資料' }) => (
  <div
    className="py-12 text-center text-sm"
    style={{ color: 'var(--color-muted)' }}
  >
    {message}
  </div>
);
