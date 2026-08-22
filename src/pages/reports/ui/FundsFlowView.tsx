import type { FundsFlowReport } from '@/entities/report';
import { cn } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface FundsFlowViewProps {
  report: FundsFlowReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * Where the money came from over the period, and what it went into.
 *
 * Side by side because the two are the same total seen from either end — a year can show healthy
 * cash and have every rupee of it come from a loan, and only setting the sources against the
 * applications says so. The difference is shown when there is one rather than hidden: on books
 * that balance at both ends of the period there cannot be one, so seeing it means something else
 * is wrong.
 */
export function FundsFlowView({ report, money }: FundsFlowViewProps) {
  return (
    <>
      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Sources of funds
            <span className={styles.panelTotal}>{money(report.totals.sources)}</span>
          </h2>
          <table className={styles.table} data-stack>
            <tbody>
              {report.sources.map((line) => (
                <tr key={`s-${line.code}`}>
                  <td>{line.name}</td>
                  <td className={styles.num}>{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.sources.length === 0 && (
            <p className={styles.empty}>Nothing was raised in this period.</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Applications of funds
            <span className={styles.panelTotal}>{money(report.totals.applications)}</span>
          </h2>
          <table className={styles.table} data-stack>
            <tbody>
              {report.applications.map((line) => (
                <tr key={`a-${line.code}`}>
                  <td>{line.name}</td>
                  <td className={styles.num}>{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.applications.length === 0 && (
            <p className={styles.empty}>Nothing was applied in this period.</p>
          )}
        </section>
      </div>

      {report.totals.difference !== '0.00' && (
        <p className={cn(styles.warning)}>
          Sources and applications do not agree — out by {money(report.totals.difference)}. The two
          are the same total seen from either end, so a difference means the books did not balance
          at one end of the period.
        </p>
      )}
    </>
  );
}
