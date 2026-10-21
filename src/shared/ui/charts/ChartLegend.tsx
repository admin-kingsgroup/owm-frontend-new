import { cn } from '@/shared/lib';

import styles from './Charts.module.css';

/* ---- Legend ----------------------------------------------------------- */

export interface LegendItem {
  label: string;
  color: string;
  /** Drawn as a short line rather than a block, for a line series. */
  line?: boolean;
  dashed?: boolean;
}

/**
 * Which colour is which. Always present for two series or more, so identity is never colour alone.
 * Text stays in ink; only the swatch carries the series colour.
 */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={cn(styles.legend, className)}>
      {items.map((item) => (
        <span className={styles.legendItem} key={item.label}>
          <i
            className={cn(
              styles.swatch,
              item.line && styles.swatchLine,
              item.dashed && styles.swatchDashed,
            )}
            style={{ background: item.color, color: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
