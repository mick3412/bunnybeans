import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const baseClass =
  'inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';

/** 品牌色盤：主 CTA 青綠；次按鈕米底；成功同主色 */
const variantClass: Record<Variant, string> = {
  primary:
    'bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-canvas',
  secondary:
    'border border-brand-surface bg-white text-neutral-900 shadow-sm hover:bg-brand-canvas focus-visible:ring-brand-surface',
  ghost: 'text-neutral-800 hover:bg-brand-surface/50 focus-visible:ring-brand-primary',
  success:
    'bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-canvas',
};

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs leading-tight',
  md: 'px-4 py-2.5 text-sm leading-snug',
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
