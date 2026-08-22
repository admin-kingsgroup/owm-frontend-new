import type { RatioReport } from '@/entities/report';

import styles from './ReportsPage.module.css';

interface RatioViewProps {
  report: RatioReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * The standard ratios, each with the two figures it came from.
 *
 * A ratio on its own is a number somebody has to trust; beside its numerator and denominator it is
 * a number they can check, and the hint says what it is actually for — these are the ones people
 * most often mix up. An unanswerable ratio prints an em dash rather than nil, because a current
 * ratio with no current liabilities is not perfect, it is undefined.
 */
export function RatioView({ report, money }: RatioViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Ratio</th>
              <th className={styles.num}>Value</th>
              <th className={styles.num}>From</th>
              <th className={styles.num}>Over</th>
              <th>What it says</th>
            </tr>
          </thead>
          <tbody>
            {report.ratios.map((line) => (
              <tr key={line.key}>
                <td>{line.label}</td>
                <td className={styles.num}>
                  {line.value === null
                    ? '—'
                    : line.unit === 'PERCENT'
                      ? `${line.value}%`
                      : `${line.value}×`}
                </td>
                <td className={styles.num}>{money(line.numerator)}</td>
                <td className={styles.num}>{money(line.denominator)}</td>
                <td>{line.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        A dash means there was nothing to divide by. That is not the same as nil — a current ratio
        with no current liabilities cannot be answered rather than being perfect.
      </p>
    </section>
  );
}
