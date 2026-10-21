import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useElementWidth } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import { useChartTip } from './chart-hooks';
import { niceScale } from './chart-math';
import styles from './Charts.module.css';

export interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  /** Drawn solid when true, as a ring when not — "meets both targets" on the portfolio. */
  filled: boolean;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  /** Where the targets sit on each axis. The corner past both is shaded. */
  xTarget?: number;
  yTarget?: number;
  xLabel: string;
  yLabel: string;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  height?: number;
  caption: string;
}

/**
 * One dot per thing measured on two ratios at once, with the targets drawn as lines.
 *
 * Reads faster than two ranked columns for the question a portfolio asks — which businesses clear
 * both bars, which clear one, which clear neither — because the answer is where the dot sits.
 */
export function ScatterChart({
  points,
  xTarget,
  yTarget,
  xLabel,
  yLabel,
  formatX,
  formatY,
  height = 260,
  caption,
}: ScatterChartProps) {
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const tip = useChartTip();

  if (points.length === 0) return <div ref={wrapRef} className={styles.chart} />;

  const width = Math.max(260, measured);
  const margin = { left: 52, right: 18, top: 14, bottom: 38 };
  const xs = points.map((p) => p.x).concat(xTarget ?? [], 0);
  const ys = points.map((p) => p.y).concat(yTarget ?? [], 0);
  const sx = niceScale(Math.min(...xs), Math.max(...xs) * 1.1, 4);
  const sy = niceScale(Math.min(...ys), Math.max(...ys) * 1.1, 4);
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (v: number) => margin.left + (plotW * (v - sx.lo)) / (sx.hi - sx.lo || 1);
  const y = (v: number) => margin.top + plotH * (1 - (v - sy.lo) / (sy.hi - sy.lo || 1));

  function onMove(event: ReactPointerEvent<SVGElement>, i: number) {
    const point = points[i];
    setHover(i);
    tip.show(event, {
      title: point.label,
      rows: [
        { color: 'transparent', label: xLabel, value: formatX(point.x) },
        { color: 'transparent', label: yLabel, value: formatY(point.y) },
      ],
    });
  }

  function onLeave(event: ReactPointerEvent<SVGElement>) {
    if (event.pointerType === 'mouse') setHover(null);
    else window.setTimeout(() => setHover(null), 1800);
    tip.hide(event);
  }

  return (
    <div ref={wrapRef} className={cn(styles.chart, hover !== null && styles.hovering)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={caption}>
        <g aria-hidden="true">
          {xTarget !== undefined && yTarget !== undefined && (
            <rect
              className={styles.zone}
              x={x(xTarget)}
              y={margin.top}
              width={Math.max(0, width - margin.right - x(xTarget))}
              height={Math.max(0, y(yTarget) - margin.top)}
            />
          )}
          {sy.ticks.map((t) => (
            <g key={`y${t}`}>
              <line
                className={t === 0 ? styles.baseline : styles.grid}
                x1={margin.left}
                x2={width - margin.right}
                y1={y(t)}
                y2={y(t)}
              />
              <text className={styles.tick} x={margin.left - 8} y={y(t) + 4} textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          {sx.ticks.map((t) => (
            <text
              key={`x${t}`}
              className={styles.tick}
              x={x(t)}
              y={height - margin.bottom + 16}
              textAnchor="middle"
            >
              {formatX(t)}
            </text>
          ))}
          <text
            className={cn(styles.tick, styles.tickStrong)}
            x={margin.left + plotW / 2}
            y={height - 4}
            textAnchor="middle"
          >
            {xLabel}
          </text>
          {xTarget !== undefined && (
            <line
              className={styles.target}
              x1={x(xTarget)}
              x2={x(xTarget)}
              y1={margin.top}
              y2={height - margin.bottom}
            />
          )}
          {yTarget !== undefined && (
            <line
              className={styles.target}
              x1={margin.left}
              x2={width - margin.right}
              y1={y(yTarget)}
              y2={y(yTarget)}
            />
          )}
        </g>

        {points.map((point, i) => {
          const cx = x(point.x);
          const cy = y(point.y);
          // The name beside the dot, on whichever side has room for it.
          const right = cx < width - margin.right - 90;
          return (
            <g
              key={`${point.label}-${i}`}
              className={cn(styles.dotGroup, hover === i && styles.hot)}
              style={{ animationDelay: `${120 + i * 70}ms` }}
              onPointerMove={(event) => onMove(event, i)}
              onPointerDown={(event) => onMove(event, i)}
              onPointerLeave={onLeave}
            >
              <circle className={styles.dotHit} cx={cx} cy={cy} r={14} />
              <circle
                className={point.filled ? styles.dot : styles.dotRing}
                cx={cx}
                cy={cy}
                r={6}
              />
              <text
                className={styles.dotLabel}
                x={right ? cx + 10 : cx - 10}
                y={cy + 4}
                textAnchor={right ? 'start' : 'end'}
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}
