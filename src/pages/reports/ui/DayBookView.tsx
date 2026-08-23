import type { DayBookReport } from '@/entities/report';
import { toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface DayBookViewProps {
  dayBook: DayBookReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/** Everything posted in the period, in the order it was posted — every type together. */
export function DayBookView({ dayBook, money }: DayBookViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Date</th>
              <th>Number</th>
              <th>Type</th>
              <th>Narration</th>
              <th className={styles.num}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {dayBook.rows.map((row) => (
              <tr key={row.voucherId}>
                <td>{toCalendarDay(row.voucherDate)}</td>
                <td>{row.voucherNumber}</td>
                <td>{row.voucherTypeCode}</td>
                <td>{row.narration ?? '—'}</td>
                <td className={styles.num}>{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className={styles.num}>{dayBook.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {dayBook.rows.length === 0 && <p className={styles.empty}>No vouchers in this period.</p>}
    </section>
  );
}
