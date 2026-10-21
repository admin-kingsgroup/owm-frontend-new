import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/shared/lib';

import { LineChart } from '../charts';
import { CountUp } from '../count-up';
import styles from './KpiTile.module.css';

export interface KpiTileProps {
  label: string;
  icon?: ReactNode;
  /** Null while unread or unreadable — drawn as a dash, never as a zero. */
  value: number | null;
  /** How the figure is written. The tile counts up through the same formatter. */
  format: (value: number) => string;
  /** Written after the figure, quieter — Dr or Cr. */
  suffix?: ReactNode;
  /** One line under the figure: what it is made of, or what it is compared with. */
  hint?: ReactNode;
  /** A change against a comparison, as a percentage. Up is drawn as good unless `invert`. */
  delta?: number | null;
  /** For a figure where going up is bad — debtor days, overdue. */
  invert?: boolean;
  /** Its shape over time, oldest first. Fewer than two points draws nothing. */
  trend?: number[];
  trendColor?: string;
  /** How a trend point is written when the line is touched. */
  formatTrend?: (value: number) => string;
  trendLabels?: string[];
  /** The statement the figure came from. A figure nobody can question is one nobody should trust. */
  to?: string;
  /** Its place in a row, for the staggered entrance. */
  index?: number;
  negative?: boolean;
}

/**
 * A headline figure: a label, the number counting up to itself, a line of context and its trend.
 *
 * The whole tile opens the statement behind it when `to` is given.
 */
export function KpiTile({
  label,
  icon,
  value,
  format,
  suffix,
  hint,
  delta,
  invert = false,
  trend,
  trendColor = 'var(--series-1)',
  formatTrend = format,
  trendLabels,
  to,
  index = 0,
  negative = false,
}: KpiTileProps) {
  const up = delta !== null && delta !== undefined && delta >= 0;
  const good = invert ? !up : up;

  const body = (
    <>
      <span className={styles.label}>
        {icon}
        {label}
      </span>
      <span className={cn(styles.value, negative && styles.negative)}>
        {value === null ? (
          <span className={styles.nil}>—</span>
        ) : (
          <CountUp value={value} format={format} />
        )}
        {value !== null && suffix && <span className={styles.suffix}>{suffix}</span>}
      </span>
      {(hint || (delta !== null && delta !== undefined)) && (
        <span className={styles.hint}>
          {delta !== null && delta !== undefined && Number.isFinite(delta) && (
            <b className={good ? styles.good : styles.bad}>
              {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
            </b>
          )}
          {hint && <span>{hint}</span>}
        </span>
      )}
      {trend && trend.length > 1 && (
        <span className={styles.trend}>
          <LineChart
            mini
            area
            height={42}
            labels={trendLabels ?? trend.map((_, i) => String(i + 1))}
            series={[{ label, values: trend, color: trendColor }]}
            formatValue={formatTrend}
            caption={`${label}, trend`}
          />
        </span>
      )}
    </>
  );

  const style = { '--i': index } as CSSProperties;

  return to ? (
    <Link className={cn(styles.tile, styles.link)} to={to} style={style}>
      {body}
    </Link>
  ) : (
    <div className={styles.tile} style={style}>
      {body}
    </div>
  );
}
