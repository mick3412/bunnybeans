import React, { useId } from 'react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, hint, className = '', id: idProp, ...props }) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-xs font-medium text-muted">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={`block w-full rounded-lg border border-brand-surface bg-table-head px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20 ${className}`.trim()}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted" role="note">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

