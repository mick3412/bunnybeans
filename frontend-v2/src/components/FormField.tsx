import React from 'react';

type Props = {
  id: string;
  label: string;
  type?: 'text' | 'number';
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  min?: number;
};

export const FormField: React.FC<Props> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
}) => (
  <div className="mb-4">
    <label htmlFor={id} className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-content)' }}>
      {label}
    </label>
    <input
      id={id}
      type={type}
      className="input-base"
      value={value}
      onChange={(e) => onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)}
      placeholder={placeholder}
      min={min}
    />
  </div>
);
