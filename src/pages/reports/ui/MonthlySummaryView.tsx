import type { MonthlySummaryReport } from '@/entities/report';

import { Figure } from './Figure';
import styles from './ReportsPage.module.css';
import { Table } from '@/shared/ui';

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
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        {report.subject.name}
        <span className={styles.panelTotal}>
          <Figure amount={money(report.totals.closing)} side={report.totals.closingSide} />
        </span>
      </h2>

      <Table surface="plain" sticky className={styles.tableWrap} stack>
        <thead>
          <tr>
            <th>Month</th>
            <th data-num>Debit</th>
            <th data-num>Credit</th>
            <th data-num>Closing</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Opening</td>
            <td data-num>—</td>
            <td data-num>—</td>
            <td data-num>
              <Figure amount={money(report.opening)} side={report.openingSide} />
            </td>
          </tr>
          {report.months.map((month) => (
            <tr key={month.month}>
              <td>{monthLabel(month.month)}</td>
              <td data-num>{money(month.debit)}</td>
              <td data-num>{money(month.credit)}</td>
              <td data-num>
                <Figure amount={money(month.closing)} side={month.closingSide} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td data-num>{money(report.totals.debit)}</td>
            <td data-num>{money(report.totals.credit)}</td>
            <td data-num>
              <Figure amount={money(report.totals.closing)} side={report.totals.closingSide} />
            </td>
          </tr>
        </tfoot>
      </Table>
    </section>
  );
}
