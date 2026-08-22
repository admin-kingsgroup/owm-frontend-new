import { useId } from 'react';

import styles from './ColumnChart.module.css';

export interface ColumnChartSeries {
  label: string;
  /** Any CSS colour. Pass a --data-* token so the series never reads as an action. */
  color: string;
  /** One value per point, in the same order as `labels`. Negatives draw below the axis. */
  values: number[];
}

export interface ColumnChartProps {
  /** One per column, already in the reader's own words — this draws them, it does not format. */
  labels: string[];
  series: ColumnChartSeries[];
  height?: number;
  /** Turns a value into the text shown on hover. */
  formatValue?: (value: number) => string;
  /**
   * The chart's accessible name. The statement below carries every figure, so a reader hears one
   * sentence naming the shape and moves on rather than being walked through bars they cannot see.
   */
  caption?: string;
}

/**
 * Grouped columns on a zero axis.
 *
 * Hand-drawn rather than pulled from a charting library: this is a handful of rects and two lines,
 * and the smallest library that would draw it costs more than every screen in the application put
 * together. Colours come in through `series` so the palette stays with the design tokens.
 *
 * Every figure here is also in the statement below, so the chart names itself once through
 * `caption` and hides its own legend and axis labels — repeating "Income, Expenses, Apr, May" to a
 * reader who cannot see which bar is which is noise, not access.
 */
export function ColumnChart({
  labels,
  series,
  height = 168,
  formatValue = (value) => value.toFixed(2),
  caption,
}: ColumnChartProps) {
  const gradientId = useId();

  if (labels.length === 0 || series.length === 0) return null;

  const all = series.flatMap((entry) => entry.values);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  // A period where everything is zero still needs a scale, or every bar divides by nothing.
  const span = max - min || 1;

  const padTop = 8;
  const padBottom = 22;
  const plot = height - padTop - padBottom;
  const zeroY = padTop + (max / span) * plot;

  const groupWidth = 100 / labels.length;
  const barWidth = (groupWidth * 0.62) / series.length;
  const groupPad = (groupWidth - barWidth * series.length) / 2;

  return (
    <figure className={styles.figure}>
      <div className={styles.legend} aria-hidden="true">
        {series.map((entry) => (
          <span key={entry.label} className={styles.legendItem}>
            <i className={styles.swatch} style={{ background: entry.color }} />
            {entry.label}
          </span>
        ))}
      </div>

      <svg
        className={styles.chart}
        viewBox={`0 0 100 ${height}`}
        /* Both are needed. preserveAspectRatio="none" lets the 100-unit viewBox stretch to any
           width, but without an explicit height the element still takes its intrinsic ratio and
           renders as tall as it is wide — which for a full-width panel is about 1,900px. */
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
      >
        <defs>
          <clipPath id={gradientId}>
            <rect x="0" y="0" width="100" height={height} />
          </clipPath>
        </defs>

        {/* The zero line is the only rule drawn: with negatives on the chart it is the reference
            every bar is read against, and more grid than that competes with the bars. */}
        <line
          x1="0"
          x2="100"
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${gradientId})`}>
          {labels.map((label, index) =>
            series.map((entry, seriesIndex) => {
              const value = entry.values[index] ?? 0;
              const magnitude = (Math.abs(value) / span) * plot;
              const x = index * groupWidth + groupPad + seriesIndex * barWidth;
              const y = value >= 0 ? zeroY - magnitude : zeroY;

              return (
                <rect
                  key={`${label}-${entry.label}`}
                  x={x}
                  y={y}
                  width={barWidth * 0.86}
                  height={Math.max(magnitude, value === 0 ? 0 : 1)}
                  fill={entry.color}
                >
                  <title>{`${label} · ${entry.label}: ${formatValue(value)}`}</title>
                </rect>
              );
            }),
          )}
        </g>
      </svg>

      <div className={styles.labels} aria-hidden="true">
        {labels.map((label) => (
          <span key={label} className={styles.label} style={{ width: `${groupWidth}%` }}>
            {label}
          </span>
        ))}
      </div>
    </figure>
  );
}
