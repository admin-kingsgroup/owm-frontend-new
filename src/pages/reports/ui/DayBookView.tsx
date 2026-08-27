import type { DayBookReport } from '@/entities/report';

import styles from './ReportsPage.module.css';
import { Table } from '@/shared/ui';

interface DayBookViewProps {
  dayBook: DayBookReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
  /** What a voucher type is called, in the company's own words, given its code. */
  typeName: (code: string) => string;
}

/** Everything posted in the period, in the order it was posted — every type together. */
export function DayBookView({ dayBook, money, day, typeName }: DayBookViewProps) {
  return (
    <section className={styles.panel}>
      <Table surface="plain" sticky className={styles.tableWrap} stack>
        <thead>
          <tr>
            <th>Date</th>
            <th>Number</th>
            <th>Type</th>
            <th>Narration</th>
            <th data-num>Amount</th>
          </tr>
        </thead>
        <tbody>
          {dayBook.rows.map((row) => (
            <tr key={row.voucherId}>
              <td>{day(row.voucherDate)}</td>
              <td>{row.voucherNumber}</td>
              {/* The type's name, not its code: CREDIT_NOTE is a database value, not a word. */}
              <td>{typeName(row.voucherTypeCode)}</td>
              <td>{row.narration ?? '—'}</td>
              <td data-num>{money(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total</td>
            {/* Through `money`, like every other figure. Printed raw, it was the one amount on
                  the screen with no grouping and no thousands separator. */}
            <td data-num>{money(dayBook.total)}</td>
          </tr>
        </tfoot>
      </Table>
      {dayBook.rows.length === 0 && <p className={styles.empty}>No vouchers in this period.</p>}
    </section>
  );
}
