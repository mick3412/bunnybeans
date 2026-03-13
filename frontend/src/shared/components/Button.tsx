import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const baseClass =
  'inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const variantClass: Record<Variant, string> = {
  primary: 'bg-sky-600 text-white shadow-sm shadow-sky-500/40 hover:bg-sky-700 focus-visible:ring-sky-400',
  secondary:
    'border border-slate-200 bg-slate-50 text-slate-800 shadow-sm hover:bg-slate-100 focus-visible:ring-slate-300',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300',
  success:
    'bg-emerald-600 text-white shadow-sm shadow-emerald-500/40 hover:bg-emerald-700 focus-visible:ring-emerald-400',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1 text-[11px]',
  md: 'px-4 py-2.5 text-sm',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  ...props
}) => {
  const widthClass = fullWidth ? 'w-full' : '';
  return (
    <button
      className={`${baseClass} ${variantClass[variant]} ${sizeClass[size]} ${widthClass} ${className}`.trim()}
      {...props}
    />
  );
};

