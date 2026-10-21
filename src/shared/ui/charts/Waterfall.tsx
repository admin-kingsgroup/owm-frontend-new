import type { PointerEvent as ReactPointerEvent } from 'react';

import { useElementWidth } from '@/shared/hooks';

import { useChartTip } from './chart-hooks';
import { niceScale } from './chart-math';
import styles from './Charts.module.css';

export interface WaterfallStep {
  label: string;
  /** For a balance, the balance itself; for a movement, how much it moved (negative takes away). */
  value: number;
  /** A balance standing on the axis — opening, closing — rather than a movement floating from the last. */
  total?: boolean;
  /** One line of explanation in the tooltip. */
  note?: string;
}

export interface WaterfallProps {
  steps: WaterfallStep[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
  caption: string;
}

/**
 * From one balance to the next: each movement floats from where the last one left off, so the eye
 * walks from opening to closing and sees what added and what took away.
 *
 * Balances are grey and stand on the axis; movements that add are blue and those that take away
 * are red — the one place a chart here uses two opposed hues, because adding and taking away are
 * opposites.
 */
export function Waterfall({
  steps,
  formatValue,
  formatAxis = formatValue,
  height = 240,
  caption,
}: WaterfallProps) {
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const tip = useChartTip();

  if (steps.length === 0) return <div ref={wrapRef} className={styles.chart} />;

  /* Where each bar starts and ends: a balance from the axis, a movement from the last bar's end. */
  const bars = steps.reduce<Array<WaterfallStep & { from: number; to: number }>>((placed, step) => {
    const before = placed.at(-1)?.to ?? 0;
    const from = step.total ? 0 : before;
    const to = step.total ? step.value : before + step.value;
    return [...placed, { ...step, from, to }];
  }, []);

  const width = Math.max(260, measured);
  const margin = { left: 64, right: 12, top: 24, bottom: 28 };
  const low = Math.min(0, ...bars.map((bar) => Math.min(bar.from, bar.to)));
  const high = Math.max(0, ...bars.map((bar) => Math.max(bar.from, bar.to)));
  const scale = niceScale(low, high, 4);
  const plotH = height - margin.top - margin.bottom;
  const y = (v: number) => margin.top + plotH * (1 - (v - scale.lo) / (scale.hi - scale.lo || 1));
  const band = (width - margin.left - margin.right) / bars.length;
  const barW = Math.min(56, band * 0.56);

  const colourOf = (bar: (typeof bars)[number]) =>
    bar.total ? 'var(--ink-faint)' : bar.value >= 0 ? 'var(--series-1)' : 'var(--series-negative)';

  function onMove(event: ReactPointerEvent<SVGRectElement>, index: number) {
    const bar = bars[index];
    tip.show(event, {
      title: bar.label,
      rows: [
        {
          color: colourOf(bar),
          label: bar.total ? 'Balance' : bar.value >= 0 ? 'Adds' : 'Takes away',
          value: formatValue(bar.value),
        },
      ],
      foot: bar.note ? { color: 'transparent', label: bar.note, value: '' } : undefined,
    });
  }

  return (
    <div ref={wrapRef} className={styles.chart}>
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
        </g>

        {bars.map((bar, index) => {
          const x0 = margin.left + index * band + (band - barW) / 2;
          const top = y(Math.max(bar.from, bar.to));
          const bottom = y(Math.min(bar.from, bar.to));
          const next = bars[index + 1];
          return (
            <g key={bar.label}>
              <rect
                className={styles.column}
                style={{
                  animationDelay: `${index * 110}ms`,
                  transformOrigin: bar.total || bar.value >= 0 ? 'bottom' : 'top',
                }}
                x={x0}
                y={top}
                width={barW}
                height={Math.max(1, bottom - top)}
                rx={4}
                fill={colourOf(bar)}
              />
              {next && (
                <line
                  className={styles.marker}
                  x1={x0 + barW}
                  x2={x0 + band}
                  y1={y(bar.to)}
                  y2={y(bar.to)}
                />
              )}
              <text
                className={`${styles.tick} ${styles.tickStrong}`}
                x={x0 + barW / 2}
                y={top - 7}
                textAnchor="middle"
              >
                {(bar.value > 0 && !bar.total ? '+' : '') + formatAxis(bar.value)}
              </text>
              <text className={styles.tick} x={x0 + barW / 2} y={height - 8} textAnchor="middle">
                {bar.label}
              </text>
              <rect
                className={styles.hit}
                x={margin.left + index * band}
                y={margin.top}
                width={band}
                height={plotH}
                onPointerMove={(event) => onMove(event, index)}
                onPointerDown={(event) => onMove(event, index)}
                onPointerLeave={tip.hide}
              />
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}
