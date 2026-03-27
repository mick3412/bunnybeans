export const HUB_TAB_ROW_CLASS = 'flex flex-wrap items-center gap-2 border-b border-brand-surface pb-3';

export function hubTabButtonClass(active: boolean): string {
  return [
    'h-8 rounded-full px-3 text-xs font-semibold transition',
    active
      ? '!bg-forge-sidebar !text-white shadow-sm ring-2 ring-brand-primary/40'
      : 'bg-white text-muted ring-1 ring-brand-surface hover:bg-table-head',
  ].join(' ');
}
