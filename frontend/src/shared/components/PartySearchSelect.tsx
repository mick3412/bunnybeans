import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PartyOption {
  partyId: string;
  displayName: string;
}

interface PartySearchSelectProps {
  options: PartyOption[];
  value: string;
  onChange: (partyId: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

/** 對象搜尋：可依名稱搜尋，選取後帶入 partyId；亦可手動輸入 partyId */
export function PartySearchSelect({
  options,
  value,
  onChange,
  placeholder = '名稱或 partyId',
  className = '',
  id,
}: PartySearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue = useMemo(() => {
    if (!value.trim()) return '';
    const opt = options.find((o) => o.partyId === value);
    return opt ? opt.displayName : value;
  }, [value, options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options.filter(
      (o) =>
        o.displayName.toLowerCase().includes(q) ||
        o.partyId.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [options, query]);

  const formatPartyIdPreview = useCallback((partyId: string): string => {
    const raw = (partyId ?? '').trim();
    const customerPrefixRe = /^customer:/i;
    const customerId = raw.replace(customerPrefixRe, '');
    if (customerId !== raw) {
      const head = customerId.slice(0, 5);
      return head ? `${head}...` : '...';
    }
    return raw;
  }, []);

  const handleBlurCommit = useCallback(() => {
    if (query.trim()) {
      const exact = options.find(
        (o) => o.partyId === query || o.displayName === query,
      );
      if (exact) {
        onChange(exact.partyId);
        setQuery('');
      } else {
        onChange(query.trim());
      }
    }
    setOpen(false);
  }, [query, options, onChange]);

  const handleBlur = useCallback(() => {
    setTimeout(handleBlurCommit, 150);
  }, [handleBlurCommit]);

  const handleSelect = useCallback(
    (opt: PartyOption) => {
      onChange(opt.partyId);
      setQuery('');
      setOpen(false);
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setQuery(v);
      setOpen(true);
      setHighlightIdx(0);
      if (!v.trim()) onChange('');
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[highlightIdx]) {
        e.preventDefault();
        handleSelect(filtered[highlightIdx]);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [open, filtered, highlightIdx, handleSelect],
  );

  useEffect(() => {
    if (!open) setHighlightIdx(0);
  }, [open]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (ev: MouseEvent) => {
      if (!el.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        className={`w-48 rounded-lg border border-brand-surface bg-table-head px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${className}`}
        placeholder={placeholder}
        value={open && query ? query : (displayValue || value)}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-brand-surface bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.partyId}
              role="option"
              aria-selected={i === highlightIdx}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlightIdx ? 'bg-brand-primary/10' : 'hover:bg-table-head'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
            >
              <span className="font-medium text-content">{opt.displayName}</span>
              <span className="ml-2 font-mono text-xs text-muted">{formatPartyIdPreview(opt.partyId)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
