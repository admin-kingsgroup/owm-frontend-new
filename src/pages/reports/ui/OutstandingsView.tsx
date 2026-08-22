import type { OutstandingsReport } from '@/entities/outstanding';
import { cn, toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';

/** Ageing bands, written the way a person reads them rather than the way they are stored. */
const BUCKET_LABELS: Record<string, string> = {
  NOT_DUE: 'Not due',
  '0_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  OVER_90: 'Over 90 days',
};

interface OutstandingsViewProps {
  outstandings: OutstandingsReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * What is still owed, bill by bill, with how long each one has been owed for.
 *
 * Receivables and payables are the same report read from either side, so they are one component —
 * two would drift, and an ageing band that means one thing on one screen and another on the other
 * is worse than no ageing at all.
 */
export function OutstandingsView({ outstandings, money }: OutstandingsViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.buckets}>
        {Object.entries(outstandings.totals.byBucket).map(([bucket, amount]) => (
          <div key={bucket} className={styles.bucket}>
            <span className={styles.bucketLabel}>{BUCKET_LABELS[bucket] ?? bucket}</span>
            <span className={styles.bucketAmount}>{amount}</span>
          </div>
        ))}
        <div className={cn(styles.bucket, styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Total</span>
          <span className={styles.bucketAmount}>{outstandings.totals.outstanding}</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Party</th>
              <th>Reference</th>
              <th>Due</th>
              <th className={styles.num}>Amount</th>
              <th className={styles.num}>Settled</th>
              <th className={styles.num}>Outstanding</th>
              <th className={styles.num}>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {outstandings.bills.map((bill) => (
              <tr key={bill.billId}>
                <td>{bill.ledgerName}</td>
                <td>{bill.reference}</td>
                <td>{bill.dueDate ? toCalendarDay(bill.dueDate) : toCalendarDay(bill.billDate)}</td>
                <td className={styles.num}>{money(bill.amount)}</td>
                <td className={styles.num}>{bill.settled}</td>
                <td className={styles.num}>{bill.outstanding}</td>
                <td className={cn(styles.num, bill.overdueDays > 0 && styles.overdue)}>
                  {bill.overdueDays > 0 ? `${bill.overdueDays}d` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {outstandings.bills.length === 0 && (
        <p className={styles.empty}>
          Nothing outstanding as at {toCalendarDay(outstandings.asOf)}.
        </p>
      )}
    </section>
  );
}
