import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useElementWidth } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { useChartTip } from './chart-hooks';
import type { TipRow } from './chart-hooks';
import { niceScale, roundedColumn } from './chart-math';
import styles from './Charts.module.css';

export interface BarSeries {
  label: string;
  /** Any CSS colour. Pass a --series-* token. */
  color: string;
  values: number[];
}

export interface BarChartProps {
  labels: string[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  tooltipLabels?: string[];
  /** A closing line in the tooltip — the month's net, say. */
  footer?: (index: number) => TipRow | undefined;
  height?: number;
  caption: string;
}

/**
 * Grouped columns on a zero axis — cash in beside cash out, income beside expenses.
 *
 * Thin columns with a 2px gap between neighbours and only the data end rounded, so a group reads
 * as a pair rather than as one block. Hovering a month dims the others.
 */
export function BarChart({
  labels,
  series,
  formatValue,
  formatAxis = formatValue,
  tooltipLabels,
  footer,
  height = 220,
  caption,
}: BarChartProps) {
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const tip = useChartTip();

  const count = labels.length;
  if (count === 0 || series.length === 0) return <div ref={wrapRef} className={styles.chart} />;

  const width = Math.max(260, measured);
  const margin = { left: 64, right: 12, top: 12, bottom: 26 };
  const all = series.flatMap((entry) => entry.values);
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all), 4);
  const plotH = height - margin.top - margin.bottom;
  const y = (v: number) => margin.top + plotH * (1 - (v - scale.lo) / (scale.hi - scale.lo || 1));
  const band = (width - margin.left - margin.right) / count;
  const gap = 2;
  const barW = Math.max(3, Math.min(28, (band * 0.7 - (series.length - 1) * gap) / series.length));
  const groupW = barW * series.length + (series.length - 1) * gap;
  const zeroY = y(0);

  function onMove(event: ReactPointerEvent<SVGRectElement>, i: number) {
    setHover(i);
    tip.show(event, {
      title: tooltipLabels?.[i] ?? labels[i],
      rows: series.map((entry) => ({
        color: entry.color,
        label: entry.label,
        value: formatValue(entry.values[i] ?? 0),
      })),
      foot: footer?.(i),
    });
  }

  function onLeave(event: ReactPointerEvent<SVGRectElement>) {
    if (event.pointerType === 'mouse') setHover(null);
    else window.setTimeout(() => setHover(null), 1800);
    tip.hide(event);
  }

  return (
    <div ref={wrapRef} className={cn(styles.chart, hover !== null && styles.hovering)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={caption}>
        <g aria-hidden="true">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? styles.baseline : styles.grid}
                x1={margin.left}
                x2={width - margin.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text className={styles.tick} x={margin.left - 8} y={y(t) + 4} textAnchor="end">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) => (
            <text
              key={`${label}-${i}`}
              className={styles.tick}
              x={margin.left + i * band + band / 2}
              y={height - 7}
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </g>

        {labels.map((label, i) =>
          series.map((entry, j) => {
            const value = entry.values[i] ?? 0;
            const x0 = margin.left + i * band + (band - groupW) / 2 + j * (barW + gap);
            return (
              <path
                key={`${label}-${entry.label}`}
                className={cn(
                  styles.column,
                  value < 0 && styles.columnDown,
                  hover === i && styles.hot,
                )}
                style={{ animationDelay: `${i * 45 + j * 30}ms` }}
                d={roundedColumn(x0, y(value), barW, zeroY)}
                fill={entry.color}
              />
            );
          }),
        )}

        {labels.map((label, i) => (
          <rect
            key={`hit-${label}-${i}`}
            className={styles.hit}
            x={margin.left + i * band}
            y={margin.top}
            width={band}
            height={plotH}
            onPointerMove={(event) => onMove(event, i)}
            onPointerDown={(event) => onMove(event, i)}
            onPointerLeave={onLeave}
          />
        ))}
      </svg>
      {tip.node}
    </div>
  );
}
