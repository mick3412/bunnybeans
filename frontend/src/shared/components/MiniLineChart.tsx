import React from 'react';

export interface MiniLineChartItem {
  label: string;
  value: number;
}

/** 簡易折線圖：依 value 畫 polyline，用於日營收等趨勢 */
export function MiniLineChart(props: {
  items: MiniLineChartItem[];
  height?: number;
  formatValue?: (n: number) => string;
  /** 雙線模式：兩組資料共軸 */
  series?: { name: string; items: MiniLineChartItem[]; stroke?: string }[];
  /** 橫軸顯示的 tick 數量（預設 2 為首尾）；設為 5 可顯示 5 個區間 */
  xAxisTicks?: number;
}) {
  const { items, height = 120, formatValue, series, xAxisTicks = 2 } = props;
  const useSeries = series && series.length > 0;
  const flatItems = useSeries ? series.flatMap((s) => s.items) : items;
  if ((useSeries && !series!.some((s) => s.items.length)) || (!useSeries && !items.length)) return null;

  const values = flatItems.map((i) => i.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const range = maxV - minV || 1;
  const cnt = useSeries ? Math.max(...series!.map((s) => s.items.length), 1) : items.length;
  const w = Math.max(200, cnt * 24);
  const h = height;
  const pad = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const div = Math.max(1, cnt - 1);

  const line = (list: MiniLineChartItem[]) =>
    list
      .map((item, i) => {
        const x = pad.left + (i / div) * chartW;
        const y = pad.top + chartH - ((item.value - minV) / range) * chartH;
        return `${x},${y}`;
      })
      .join(' ');

  const labels = useSeries ? series![0].items.map((i) => i.label) : items.map((i) => i.label);

  const tickIndices =
    xAxisTicks > 2 && labels.length > 1
      ? Array.from({ length: xAxisTicks }, (_, i) =>
          Math.round((i / (xAxisTicks - 1)) * (labels.length - 1)),
        )
      : labels.length > 0
        ? [0, labels.length - 1].filter((a, i, arr) => arr.indexOf(a) === i)
        : [];
  const tickLabels = tickIndices.map((i) => labels[i] ?? '');

  return (
    <div className="flex flex-col gap-2">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="min-h-[80px] max-h-[140px]">
        {useSeries
          ? series!.map((s, idx) => (
              <polyline
                key={s.name}
                fill="none"
                stroke={s.stroke ?? (idx === 0 ? 'var(--color-brand-primary)' : 'var(--color-brand-success)')}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={line(s.items)}
              />
            ))
          : (
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-brand-primary"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={line(items)}
            />
          )}
      </svg>
      <div className="flex justify-between text-xs text-muted">
        {tickLabels.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      {formatValue && maxV > 0 && (
        <div className="text-right text-xs font-medium tabular-nums text-content">
          {formatValue(maxV)}
        </div>
      )}
    </div>
  );
}
