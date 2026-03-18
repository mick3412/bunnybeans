import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  type?: 'button' | 'submit';
  variant?: Variant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[var(--color-primary)] text-white hover:opacity-95',
  secondary: 'border bg-white text-[var(--color-content)] hover:bg-[var(--color-table-head)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-95',
};

export const Button: React.FC<Props> = ({
  type = 'button',
  variant = 'primary',
  children,
  onClick,
  disabled,
  className = '',
}) => {
  const base = 'rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50';
  const border = variant === 'secondary' ? 'border-[var(--color-border)]' : 'border-transparent';
  return (
    <button
      type={type}
      className={`${base} ${border} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
