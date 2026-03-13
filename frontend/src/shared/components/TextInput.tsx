import React from 'react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, hint, className = '', ...props }) => {
  return (
    <div className="space-y-1.5">
      {label ? <label className="block text-xs font-medium text-slate-700">{label}</label> : null}
      <input
        className={`block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 ${className}`.trim()}
        {...props}
      />
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
};

