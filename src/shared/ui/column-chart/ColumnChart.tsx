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
   * Rendered once at the top of the plot, so the reader can size every bar against a number
   * instead of against the tallest bar. Without it a single large month says only "the others are
   * smaller", which is not worth a chart.
   */
  scaleLabel?: (value: number) => string;
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
  scaleLabel,
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

  /*
    A ceiling on how wide one month may be drawn.

    The viewBox is 100 units stretched to the container, so with two months in the books each bar
    came out about 270px across — three slabs filling a 1,300px panel, which reads as a design
    accident rather than as data. Twelve months never reach the cap; a short year stops growing and
    the plot simply ends where the data does.
  */
  const plotStyle = { maxWidth: `${labels.length * 116}px` };

  return (
    <figure className={styles.figure}>
      <div className={styles.head} aria-hidden="true">
        <div className={styles.legend}>
          {series.map((entry) => (
            <span key={entry.label} className={styles.legendItem}>
              <i className={styles.swatch} style={{ background: entry.color }} />
              {entry.label}
            </span>
          ))}
        </div>
        {/* Sits with the dashed rule it names, at the ceiling of the plot — below the bars it
            would read as a total rather than as the scale. */}
        {scaleLabel && max > 0 && <span className={styles.scale}>{scaleLabel(max)}</span>}
      </div>

      <svg
        className={styles.chart}
        style={plotStyle}
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

        {scaleLabel && max > 0 && (
          <line
            x1="0"
            x2="100"
            y1={padTop}
            y2={padTop}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

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
                  /*
                    A non-zero month must stay visible next to a much larger one. One unit of a
                    168-unit box is about a pixel and reads as nothing, so anything that actually
                    happened gets at least three — the shape stays honest, the month stays legible.
                  */
                  height={Math.max(magnitude, value === 0 ? 0 : 3)}
                  fill={entry.color}
                >
                  <title>{`${label} · ${entry.label}: ${formatValue(value)}`}</title>
                </rect>
              );
            }),
          )}
        </g>
      </svg>

      <div className={styles.labels} style={plotStyle} aria-hidden="true">
        {labels.map((label) => (
          <span key={label} className={styles.label} style={{ width: `${groupWidth}%` }}>
            {label}
          </span>
        ))}
      </div>
    </figure>
  );
}
