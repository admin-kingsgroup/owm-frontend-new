import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';

import { useChartTip } from './chart-hooks';
import { ChartLegend } from './ChartLegend';
import styles from './Charts.module.css';

export interface StackedBarRow {
  label: string;
  /** One per bucket, in bucket order. */
  parts: number[];
  /** Where the label leads — the statement behind the row. */
  to?: string;
}

export interface StackedBarsProps {
  rows: StackedBarRow[];
  /** The bucket names, in order: "Not due", "1-30 days"… */
  buckets: string[];
  /** One colour per bucket. Defaults to the ordered blue scale, lightest first. */
  colors?: string[];
  formatValue: (value: number) => string;
  /** Short form for the total at the end of each row. Defaults to formatValue. */
  formatTotal?: (value: number) => string;
}

const ORDERED = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];

/**
 * One bar per row, split by bucket, each bar as long as its row's total against the largest.
 *
 * Built for ageing — older is darker, so the eye goes to the dark end of a bar without being told
 * to. HTML rather than SVG: these are rows of a list, and a label that wraps or links is easier as
 * text than as a <text> element.
 */
export function StackedBars({
  rows,
  buckets,
  colors = ORDERED,
  formatValue,
  formatTotal = formatValue,
}: StackedBarsProps) {
  const tip = useChartTip();
  const totals = rows.map((row) => row.parts.reduce((sum, part) => sum + Math.max(0, part), 0));
  const max = Math.max(0, ...totals);

  return (
    <div>
      <div className={styles.stack}>
        {rows.map((row, ri) => (
          <div className={styles.stackRow} key={row.label} style={{ '--i': ri } as CSSProperties}>
            {row.to ? (
              <Link className={styles.stackLabel} to={row.to} title={row.label}>
                {row.label}
              </Link>
            ) : (
              <span className={styles.stackLabel} title={row.label}>
                {row.label}
              </span>
            )}
            <div>
              {totals[ri] > 0 && (
                <div
                  className={styles.stackTrack}
                  style={{ width: `${(totals[ri] / max) * 100}%` }}
                  aria-hidden="true"
                >
                  {row.parts.map((part, i) =>
                    part > 0 ? (
                      <span
                        key={buckets[i]}
                        className={styles.stackPart}
                        style={{ flex: part, background: colors[i] }}
                        onPointerMove={(event) =>
                          tip.show(event, {
                            title: row.label,
                            rows: [
                              { color: colors[i], label: buckets[i], value: formatValue(part) },
                            ],
                          })
                        }
                        onPointerDown={(event) =>
                          tip.show(event, {
                            title: row.label,
                            rows: [
                              { color: colors[i], label: buckets[i], value: formatValue(part) },
                            ],
                          })
                        }
                        onPointerLeave={tip.hide}
                      />
                    ) : null,
                  )}
                </div>
              )}
            </div>
            <span className={styles.stackTotal}>{formatTotal(totals[ri])}</span>
          </div>
        ))}
      </div>
      <ChartLegend
        className={styles.stackLegend}
        items={buckets.map((bucket, i) => ({ label: bucket, color: colors[i] }))}
      />
      {tip.node}
    </div>
  );
}
