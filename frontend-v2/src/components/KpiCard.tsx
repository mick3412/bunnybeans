import React from 'react';

const accents = [
  'var(--kpi-accent-1)',
  'var(--kpi-accent-2)',
  'var(--kpi-accent-3)',
  'var(--kpi-accent-4)',
] as const;

type Props = {
  label: string;
  value: string | number;
  index?: number;
};

export const KpiCard: React.FC<Props> = ({ label, value, index = 0 }) => {
  const accent = accents[index % accents.length];
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        borderLeftWidth: '3px',
        borderLeftColor: accent,
      }}
    >
      <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-content)' }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
    </div>
  );
};
