import React from 'react';

export type PartyView = 'all' | 'customer' | 'supplier' | 'other';

export const PARTY_VIEW_LABEL: Record<PartyView, string> = {
  all: '全部視角',
  customer: '會員視角',
  supplier: '供應商視角',
  other: '其他對象',
};

export const PartyViewSegmented: React.FC<{
  value: PartyView;
  onChange: (next: PartyView) => void;
}> = ({ value, onChange }) => {
  const btn = (k: PartyView, activeCls: string) =>
    [
      'rounded-full px-3 py-1.5 text-xs font-medium transition',
      value === k ? activeCls : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
    ].join(' ');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn('all', 'bg-forge-sidebar text-white')} onClick={() => onChange('all')}>
        全部視角
      </button>
      <button type="button" className={btn('customer', 'bg-brand-primary text-white')} onClick={() => onChange('customer')}>
        會員視角
      </button>
      <button type="button" className={btn('supplier', 'bg-brand-success text-white')} onClick={() => onChange('supplier')}>
        供應商視角
      </button>
      <button type="button" className={btn('other', 'bg-muted text-white')} onClick={() => onChange('other')}>
        其他對象
      </button>
    </div>
  );
};

