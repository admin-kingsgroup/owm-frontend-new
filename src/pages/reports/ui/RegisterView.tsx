import type { DayBookReport } from '@/entities/report';
import { toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface RegisterViewProps {
  register: DayBookReport;
  /** What the type is called, in the company's own words. */
  title: string;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * The Day Book narrowed to one voucher type — Tally's Sales, Purchase, Journal and the rest.
 *
 * The same rows the Day Book shows, which is deliberate: a register that counted differently from
 * the book it is a slice of would be two answers to one question.
 */
export function RegisterView({ register, title, money }: RegisterViewProps) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>
        {title}
        <span className={styles.panelTotal}>{money(register.total)}</span>
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Date</th>
              <th>Number</th>
              <th>Narration</th>
              <th>Status</th>
              <th className={styles.num}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {register.rows.map((row) => (
              <tr key={row.voucherId}>
                <td>{toCalendarDay(row.voucherDate)}</td>
                <td>{row.voucherNumber}</td>
                <td>{row.narration ?? '—'}</td>
                <td>{row.status}</td>
                <td className={styles.num}>{money(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {register.rows.length === 0 && (
        <p className={styles.empty}>Nothing of this type in the period.</p>
      )}
    </section>
  );
}
