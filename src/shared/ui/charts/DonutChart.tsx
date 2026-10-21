import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { cn } from '@/shared/lib';

import { useChartTip } from './chart-hooks';
import styles from './Charts.module.css';

export interface DonutPart {
  label: string;
  value: number;
  /** Any CSS colour. Pass a --series-* token. */
  color: string;
}

export interface DonutChartProps {
  parts: DonutPart[];
  formatValue: (value: number) => string;
  /** The figure in the hole — the whole the parts make up. */
  center: string;
  /** A word or two under it. */
  sub?: string;
  size?: number;
  caption: string;
}

/**
 * Shares of one whole as a ring.
 *
 * Only for parts that are all on one side of nought — a ring cannot draw a loss. The caller is
 * expected to fall back to its table when any part is negative, which is why this draws nothing
 * rather than something misleading when given one.
 */
export function DonutChart({
  parts,
  formatValue,
  center,
  sub,
  size = 168,
  caption,
}: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const tip = useChartTip();

  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (parts.length === 0 || total <= 0 || parts.some((part) => part.value < 0)) return null;

  const stroke = 18;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Each arc starts where the ones before it ended; a small gap keeps neighbours apart.
  const gap = parts.length > 1 ? 2 : 0;
  const arcs = parts.reduce<Array<{ part: DonutPart; length: number; offset: number }>>(
    (list, part) => {
      const before = list.length ? list[list.length - 1].offset + list[list.length - 1].length : 0;
      const length = (part.value / total) * circumference;
      return [...list, { part, length, offset: before }];
    },
    [],
  );

  function onMove(event: ReactPointerEvent<SVGCircleElement>, i: number) {
    const part = parts[i];
    setHover(i);
    tip.show(event, {
      title: part.label,
      rows: [
        { color: part.color, label: 'Amount', value: formatValue(part.value) },
        {
          color: 'transparent',
          label: 'Of the whole',
          value: `${((part.value / total) * 100).toFixed(0)}%`,
        },
      ],
    });
  }

  function onLeave(event: ReactPointerEvent<SVGCircleElement>) {
    if (event.pointerType === 'mouse') setHover(null);
    else window.setTimeout(() => setHover(null), 1800);
    tip.hide(event);
  }

  return (
    <div className={cn(styles.donut, hover !== null && styles.hovering)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={caption}
      >
        <circle
          className={styles.donutTrack}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map(({ part, length, offset }, i) => (
            <circle
              key={part.label}
              className={cn(styles.donutArc, hover === i && styles.hot)}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={part.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0.5, length - gap)} ${circumference}`}
              strokeDashoffset={-offset}
              style={{ animationDelay: `${i * 90}ms` }}
              onPointerMove={(event) => onMove(event, i)}
              onPointerDown={(event) => onMove(event, i)}
              onPointerLeave={onLeave}
            />
          ))}
        </g>
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <b>{center}</b>
        {sub && <span>{sub}</span>}
      </div>
      {tip.node}
    </div>
  );
}
