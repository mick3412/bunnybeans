import React from 'react';

export type KpiCardAccent = 'blue' | 'green' | 'amber' | 'slate';
export type KpiCardTrend = 'up' | 'down' | 'warn';

export function KpiCard(props: {
  label: string;
  sub: string;
  value: string;
  trend?: KpiCardTrend;
  trendText?: string;
  dot?: 'amber' | 'red' | 'emerald';
  accent?: KpiCardAccent;
}) {
  const trendColor =
    props.trend === 'up'
      ? 'text-emerald-600'
      : props.trend === 'down'
        ? 'text-amber-600'
        : props.trend === 'warn'
          ? 'text-amber-600'
          : 'text-muted';
  const accentClass =
    props.accent === 'blue'
      ? 'kpi-card-accent-blue'
      : props.accent === 'green'
        ? 'kpi-card-accent-green'
        : props.accent === 'amber'
          ? 'kpi-card-accent-amber'
          : props.accent === 'slate'
            ? 'kpi-card-accent-slate'
            : '';
  return (
    <div className={`rounded-xl border border-brand-surface bg-forge-card p-5 shadow-sm ${accentClass}`}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{props.label}</p>
        {props.dot === 'amber' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
        {props.dot === 'red' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />}
        {props.dot === 'emerald' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-content">{props.value}</p>
      <p className="mt-1 text-sm text-muted">{props.sub}</p>
      {props.trendText && (
        <p className={`mt-2 text-xs font-medium tabular-nums ${trendColor}`}>{props.trendText}</p>
      )}
    </div>
  );
}
