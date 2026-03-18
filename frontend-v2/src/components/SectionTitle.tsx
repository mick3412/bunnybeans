import React from 'react';

type Props = { children: React.ReactNode; className?: string };

export const SectionTitle: React.FC<Props> = ({ children, className = '' }) => (
  <h2 className={`section-title ${className}`}>{children}</h2>
);
