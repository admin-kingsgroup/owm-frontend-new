import { useId, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useElementWidth } from '@/shared/hooks';

import { useChartTip, useDrawLengths } from './chart-hooks';
import { niceScale } from './chart-math';
import styles from './Charts.module.css';

export interface LineSeries {
  label: string;
  /** Any CSS colour. Pass a --series-* token. */
  color: string;
  /** One per label; null leaves a gap (a month not reported, a forecast not yet begun). */
  values: Array<number | null>;
  /** A comparison or a projection — drawn dashed, without an area beneath it. */
  dashed?: boolean;
}

export interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  /** How a value is written in the tooltip — the full figure. */
  formatValue: (value: number) => string;
  /** How a tick is written on the axis. Defaults to formatValue; pass a compact one. */
  formatAxis?: (value: number) => string;
  /** Longer names for the tooltip title, where the axis labels are abbreviated. */
  tooltipLabels?: string[];
  height?: number;
  /** A soft fill under each solid line. */
  area?: boolean;
  /** A range drawn behind the lines — the likely band of a forecast. */
  band?: { low: Array<number | null>; high: Array<number | null>; color: string; label: string };
  /** A dashed vertical rule at one point, with a caption — "Forecast". */
  marker?: { index: number; label: string };
  /** Include zero on the axis. On by default; a running balance that never nears zero turns it off. */
  zero?: boolean;
  /** No axes, no grid: a trend inside a tile. */
  mini?: boolean;
  /** The chart's accessible name: one sentence naming its shape. */
  caption: string;
}

/**
 * A line over time, with a crosshair that reads every series at the month under the pointer.
 *
 * Drawn to the width it is given rather than stretched (see useElementWidth), so the axis text
 * stays the size of the rest of the page at any width.
 */
export function LineChart({
  labels,
  series,
  formatValue,
  formatAxis = formatValue,
  tooltipLabels,
  height = 220,
  area = false,
  band,
  marker,
  zero = true,
  mini = false,
  caption,
}: LineChartProps) {
  const id = useId();
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>(mini ? 160 : 600);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const tip = useChartTip();

  const width = Math.max(mini ? 80 : 260, measured);
  const margin = mini
    ? { left: 3, right: 5, top: 5, bottom: 3 }
    : { left: 64, right: 16, top: 12, bottom: 26 };
  const count = labels.length;

  const geometry = useMemo(() => {
    const values = series.flatMap((entry) => entry.values.filter((v): v is number => v !== null));
    if (band) {
      values.push(...band.low.filter((v): v is number => v !== null));
      values.push(...band.high.filter((v): v is number => v !== null));
    }
    if (values.length === 0) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (zero && !mini) min = Math.min(0, min);
    if (zero && !mini) max = Math.max(0, max);
    const scale = mini
      ? {
          lo: min - (max - min || 1) * 0.12,
          hi: max + (max - min || 1) * 0.1,
          ticks: [] as number[],
        }
      : niceScale(min, max, 4);
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const x = (i: number) => margin.left + (count <= 1 ? plotW / 2 : (i * plotW) / (count - 1));
    const y = (v: number) => margin.top + plotH * (1 - (v - scale.lo) / (scale.hi - scale.lo || 1));
    return { scale, x, y, plotW, plotH };
  }, [
    series,
    band,
    zero,
    mini,
    width,
    height,
    count,
    margin.left,
    margin.right,
    margin.top,
    margin.bottom,
  ]);

  useDrawLengths(svg, geometry);

  if (!geometry || count === 0) return <div ref={wrapRef} className={styles.chart} />;
  const { scale, x, y } = geometry;
  const baseY = y(Math.max(scale.lo, Math.min(0, scale.hi)));
  const every = Math.max(1, Math.ceil(count / Math.max(2, Math.floor((width - 80) / 48))));

  const paths = series.map((entry) => {
    let d = '';
    let pen = false;
    let first: [number, number] | null = null;
    let last: [number, number] | null = null;
    entry.values.forEach((value, i) => {
      if (value === null) {
        pen = false;
        return;
      }
      const point: [number, number] = [x(i), y(value)];
      d += `${pen ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
      pen = true;
      first ??= point;
      last = point;
    });
    return {
      entry,
      d,
      first: first as [number, number] | null,
      last: last as [number, number] | null,
    };
  });

  const bandPath = (() => {
    if (!band) return '';
    const idx = band.low
      .map((v, i) => (v === null || band.high[i] === null ? -1 : i))
      .filter((i) => i >= 0);
    if (idx.length < 2) return '';
    const top = idx.map((i) => `${x(i)},${y(band.high[i] as number)}`);
    const bottom = [...idx].reverse().map((i) => `${x(i)},${y(band.low[i] as number)}`);
    return `M${top.join('L')}L${bottom.join('L')}Z`;
  })();

  function onMove(event: ReactPointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const i = Math.max(
      0,
      Math.min(
        count - 1,
        Math.round(((px - margin.left) / (width - margin.left - margin.right)) * (count - 1)),
      ),
    );
    setHover(i);
    const rows = series
      .filter((entry) => entry.values[i] !== null && entry.values[i] !== undefined)
      .map((entry) => ({
        color: entry.color,
        label: entry.label,
        value: formatValue(entry.values[i] as number),
      }));
    const low = band?.low[i];
    const high = band?.high[i];
    tip.show(event, {
      title: tooltipLabels?.[i] ?? labels[i],
      rows,
      foot:
        band && low !== null && low !== undefined && high !== null && high !== undefined
          ? {
              color: band.color,
              label: band.label,
              value: `${formatValue(low)} – ${formatValue(high)}`,
            }
          : undefined,
    });
  }

  function onLeave(event: ReactPointerEvent<SVGRectElement>) {
    if (event.pointerType === 'mouse') setHover(null);
    else window.setTimeout(() => setHover(null), 1800);
    tip.hide(event);
  }

  return (
    <div ref={wrapRef} className={styles.chart}>
      <svg
        ref={setSvg}
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        role="img"
        aria-label={caption}
      >
        <defs>
          {series.map((entry, k) => (
            <linearGradient key={entry.label} id={`${id}-g${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={entry.color} stopOpacity={mini ? 0.28 : 0.2} />
              <stop offset="1" stopColor={entry.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {!mini && (
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
            {labels.map((label, i) =>
              i % every === 0 || i === count - 1 ? (
                <text
                  key={`${label}-${i}`}
                  className={styles.tick}
                  x={x(i)}
                  y={height - 7}
                  textAnchor="middle"
                >
                  {label}
                </text>
              ) : null,
            )}
          </g>
        )}

        {bandPath && (
          <path className={styles.area} d={bandPath} fill={band?.color} fillOpacity={0.14} />
        )}

        {marker && !mini && (
          <g aria-hidden="true">
            <line
              className={styles.marker}
              x1={x(marker.index)}
              x2={x(marker.index)}
              y1={margin.top}
              y2={height - margin.bottom}
            />
            <text className={styles.tick} x={x(marker.index) + 6} y={margin.top + 10}>
              {marker.label}
            </text>
          </g>
        )}

        {paths.map(({ entry, d, first, last }, k) =>
          d ? (
            <g key={entry.label}>
              {area && !entry.dashed && first && last && (
                <path
                  className={styles.area}
                  d={`${d}L${last[0]},${mini ? height : baseY}L${first[0]},${mini ? height : baseY}Z`}
                  fill={`url(#${id}-g${k})`}
                />
              )}
              <path
                data-draw={entry.dashed ? undefined : ''}
                className={entry.dashed ? styles.dashed : styles.line}
                d={d}
                stroke={entry.color}
                strokeWidth={mini ? 1.8 : 2}
              />
              {last && (
                <circle
                  className={styles.end}
                  cx={last[0]}
                  cy={last[1]}
                  r={mini ? 3 : 4}
                  fill={entry.color}
                />
              )}
            </g>
          ) : null,
        )}

        {hover !== null && (
          <g aria-hidden="true">
            <line
              className={styles.guide}
              x1={x(hover)}
              x2={x(hover)}
              y1={margin.top}
              y2={height - margin.bottom}
            />
            {series.map((entry) => {
              const value = entry.values[hover];
              return value === null || value === undefined ? null : (
                <circle
                  key={entry.label}
                  cx={x(hover)}
                  cy={y(value)}
                  r={4.5}
                  fill={entry.color}
                  stroke="var(--paper-card)"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        )}

        <rect
          className={styles.hit}
          x={margin.left}
          y={0}
          width={Math.max(0, width - margin.left - margin.right)}
          height={height}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={onLeave}
        />
      </svg>
      {tip.node}
    </div>
  );
}
