import React from 'react';
import { EmptyState } from './EmptyState';

type Props = {
  columns: { key: string; label: string }[];
  rows: Record<string, React.ReactNode>[];
  stickyHeader?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
};

export const DataTable: React.FC<Props> = ({
  columns,
  rows,
  stickyHeader = true,
  maxHeight = '20rem',
  emptyMessage,
}) => {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-md border"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <EmptyState message={emptyMessage} />
      </div>
    );
  }
  return (
    <div
      className="overflow-auto rounded-md border"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        maxHeight: stickyHeader ? maxHeight : undefined,
      }}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b px-4 py-2.5 text-left font-semibold"
                style={{
                  backgroundColor: 'var(--color-table-head)',
                  color: 'var(--color-content)',
                  borderColor: 'var(--color-border)',
                  ...(stickyHeader
                    ? { position: 'sticky', top: 0, zIndex: 1, boxShadow: '0 1px 0 var(--color-border)' }
                    : {}),
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b last:border-b-0 hover:bg-[#f8fafc]"
              style={{ borderColor: '#f1f5f9' }}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5" style={{ color: 'var(--color-content)' }}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
