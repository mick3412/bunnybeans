import React from 'react';
import { Link } from 'react-router-dom';

export interface MiniBarChartItem {
  label: string;
  value: number;
  /** 若有 href，label 可點選跳轉 */
  href?: string;
  /** 可選：用於 React key，避免同 label 時衝突 */
  id?: string;
  /** 可選：用於 E2E 辨識，如 data-testid */
  dataTestId?: string;
}

export function MiniBarChart(props: {
  items: MiniBarChartItem[];
  max?: number;
  formatValue?: (n: number) => string;
}) {
  const { items, max, formatValue } = props;
  if (!items.length) return null;
  const maxValue = max ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = maxValue > 0 ? Math.max(4, Math.round((item.value / maxValue) * 100)) : 0;
        const display = formatValue ? formatValue(item.value) : item.value.toLocaleString();
        return (
          <div
            key={item.id ?? item.label}
            className="flex items-center gap-3"
            title={`${item.label}：${display}`}
          >
            <span className="w-28 shrink-0 truncate text-xs text-muted">
              {item.href ? (
                <Link
                  to={item.href}
                  className="text-brand-primary hover:underline"
                  title={item.label}
                  data-testid={item.dataTestId}
                >
                  {item.label}
                </Link>
              ) : (
                item.label
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="h-2 rounded-full bg-brand-surface">
                <div
                  className="h-2 rounded-full bg-brand-primary"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-content">
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

