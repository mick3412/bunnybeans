import React from 'react';

type Props = {
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export const FloatBar: React.FC<Props> = ({ left, right }) => {
  return (
    <div
      className="sticky bottom-0 -mx-6 mt-6 flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        marginBottom: '-1.5rem',
      }}
    >
      <div>{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
};
