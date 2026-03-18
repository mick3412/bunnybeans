import React from 'react';

type Variant = 'success' | 'warning' | 'info';

const styles: Record<Variant, React.CSSProperties> = {
  success: { backgroundColor: 'rgba(22, 163, 74, 0.12)', color: '#166534' },
  warning: { backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#c2410c' },
  info: { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0369a1' },
};

type Props = { variant: Variant; children: React.ReactNode };

export const StatusTag: React.FC<Props> = ({ variant, children }) => {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-medium"
      style={styles[variant]}
    >
      {children}
    </span>
  );
};
