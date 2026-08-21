import { useId } from 'react';

import styles from './Sparkline.module.css';

export interface SparklineProps {
  /** Oldest first. Fewer than two points draws nothing — a line needs somewhere to go. */
  values: number[];
  width?: number;
  height?: number;
  /** Any CSS colour; defaults to the accent. Pass a --data-* token for chart series. */
  color?: string;
  /** Describes the shape for screen readers. Without it the graphic is hidden from them. */
  label?: string;
}

/**
 * A small trend line with a filled area and an emphasised endpoint.
 *
 * Hand-drawn rather than pulled from a charting library: this is a polyline and a path, and a
 * dependency would cost more in bundle than the whole overview screen. Values are normalised to
 * their own min and max, so the shape reads as a direction of travel and not as an absolute
 * figure — the number beside it is what carries the amount.
 */
export function Sparkline({
  values,
  width = 88,
  height = 30,
  color = 'var(--accent)',
  label,
}: SparklineProps) {
  const gradientId = useId();

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series has no range to divide by; place it on the centre line rather than at an edge.
  const span = max - min;
  const pad = 3;
  const usable = height - pad * 2;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = span === 0 ? height / 2 : pad + (1 - (value - min) / span) * usable;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];
  const area = `M0,${height} L${points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' L')} L${width},${height} Z`;

  return (
    <svg
      className={styles.chart}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="2.6" fill={color} />
    </svg>
  );
}
