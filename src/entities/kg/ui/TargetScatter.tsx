import { ScatterChart } from '@/shared/ui';

import type { PortfolioView } from '../model/types';

import styles from './Portfolio.module.css';

/**
 * Every business that reported, placed by its margin across and its return up, with the two
 * targets drawn through the plot. Solid where both are met, a ring where either is missed.
 *
 * A business missing either ratio is left off rather than drawn at nought — it had nothing to
 * measure, and a dot on the axis would say it scored zero.
 */
export function TargetScatter({ view, height }: { view: PortfolioView; height?: number }) {
  const points = view.businesses
    .filter((row) => row.roiPercent !== undefined && row.netMarginPercent !== undefined)
    .map((row) => ({
      label: row.businessName,
      x: Number(row.netMarginPercent),
      y: Number(row.roiPercent),
      filled: row.meetsRoiTarget === true && row.meetsMarginTarget === true,
    }));

  if (points.length === 0) {
    return <p className={styles.quiet}>No business has both a margin and a return to place.</p>;
  }

  const left = view.businesses.length - points.length;
  const pct = (value: number) => `${Number(value.toFixed(1))}%`;

  return (
    <>
      <ScatterChart
        points={points}
        xTarget={view.targets.netMarginPercentPerMonth}
        yTarget={view.targets.roiPercentPerMonth}
        xLabel="Net margin a month"
        yLabel="Return a month"
        formatX={pct}
        formatY={pct}
        height={height}
        caption={`Each business by net margin and return, against targets of ${view.targets.netMarginPercentPerMonth}% and ${view.targets.roiPercentPerMonth}%`}
      />
      <div className={styles.key}>
        <span>
          <i className={styles.keyDot} />
          Meets both
        </span>
        <span>
          <i className={styles.keyRing} />
          Misses one or both
        </span>
        <span>
          <i className={styles.keyLine} />
          Target
        </span>
        {left > 0 && <span>{left} left off — nothing to measure</span>}
      </div>
    </>
  );
}
