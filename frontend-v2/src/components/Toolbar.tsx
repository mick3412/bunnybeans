import React from 'react';

type Props = { children: React.ReactNode; className?: string };

export const Toolbar: React.FC<Props> = ({ children, className = '' }) => (
  <div className={`toolbar ${className}`}>{children}</div>
);
