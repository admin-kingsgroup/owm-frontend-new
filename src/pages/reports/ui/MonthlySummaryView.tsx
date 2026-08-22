import type { MonthlySummaryReport } from '@/entities/report';

import styles from './ReportsPage.module.css';

interface MonthlySummaryViewProps {
  report: MonthlySummaryReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a month the way the company writes dates. */
  monthLabel: (month: string) => string;
}

/**
 * One account across the months of the year — Tally's monthly columnar summary.
 *
 * The question it answers is not "what is the balance" but "when did it move", and that only reads
 * if every month is present: a year with April, July and November listed and the rest missing
 * hides the very quiet stretches the reader is looking for. A month with no movement still shows
 * the balance it carried, which is a fact rather than a filler.
 */
export function MonthlySummaryView({ report, money, monthLabel }: MonthlySummaryViewProps) {
  const side = (value: 'DEBIT' | 'CREDIT') => (value === 'DEBIT' ? 'Dr' : 'Cr');

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        {report.subject.name}
        <span className={styles.panelTotal}>
          {money(report.totals.closing)}
          <span className={styles.priorSide}>{side(report.totals.closingSide)}</span>
        </span>
      </h2>

      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Month</th>
              <th className={styles.num}>Debit</th>
              <th className={styles.num}>Credit</th>
              <th className={styles.num}>Closing</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Opening</td>
              <td className={styles.num}>—</td>
              <td className={styles.num}>—</td>
              <td className={styles.num}>
                {money(report.opening)}
                <span className={styles.priorSide}>{side(report.openingSide)}</span>
              </td>
            </tr>
            {report.months.map((month) => (
              <tr key={month.month}>
                <td>{monthLabel(month.month)}</td>
                <td className={styles.num}>{money(month.debit)}</td>
                <td className={styles.num}>{money(month.credit)}</td>
                <td className={styles.num}>
                  {money(month.closing)}
                  <span className={styles.priorSide}>{side(month.closingSide)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className={styles.num}>{money(report.totals.debit)}</td>
              <td className={styles.num}>{money(report.totals.credit)}</td>
              <td className={styles.num}>
                {money(report.totals.closing)}
                <span className={styles.priorSide}>{side(report.totals.closingSide)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
