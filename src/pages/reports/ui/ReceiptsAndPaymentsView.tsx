import type { ReceiptsAndPaymentsReport } from '@/entities/report';
import { cn } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface ReceiptsAndPaymentsViewProps {
  report: ReceiptsAndPaymentsReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
}

/**
 * A cash-basis statement: what came in, what went out, and the balance either side of it.
 *
 * Only money is counted, which is why it disagrees with the Profit & Loss for anyone who sells on
 * credit — and why the closing figure is footed against opening plus receipts less payments rather
 * than simply printed.
 */
export function ReceiptsAndPaymentsView({
  report: receiptsPayments,
  money,
}: ReceiptsAndPaymentsViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.buckets}>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Opening</span>
          <span className={styles.bucketAmount}>{money(receiptsPayments.openingBalance)}</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Receipts</span>
          <span className={styles.bucketAmount}>{receiptsPayments.totals.receipts}</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Payments</span>
          <span className={styles.bucketAmount}>{receiptsPayments.totals.payments}</span>
        </div>
        <div className={cn(styles.bucket, styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Closing</span>
          <span className={styles.bucketAmount}>{money(receiptsPayments.closingBalance)}</span>
        </div>
      </div>

      <p className={styles.hint}>
        Only money that actually moved. An invoice raised but unpaid is income, so it appears on the
        Profit &amp; Loss and not here.
      </p>

      <div className={styles.twoColumn}>
        <div>
          <h2 className={styles.panelTitle}>
            Receipts <span className={styles.panelTotal}>{receiptsPayments.totals.receipts}</span>
          </h2>
          <table className={styles.table} data-stack>
            <tbody>
              {receiptsPayments.receipts.map((row) => (
                <tr key={`r-${row.ledgerId}`}>
                  <td>{row.name}</td>
                  <td className={styles.num}>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {receiptsPayments.receipts.length === 0 && (
            <p className={styles.empty}>Nothing received in this period.</p>
          )}
        </div>
        <div>
          <h2 className={styles.panelTitle}>
            Payments <span className={styles.panelTotal}>{receiptsPayments.totals.payments}</span>
          </h2>
          <table className={styles.table} data-stack>
            <tbody>
              {receiptsPayments.payments.map((row) => (
                <tr key={`p-${row.ledgerId}`}>
                  <td>{row.name}</td>
                  <td className={styles.num}>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {receiptsPayments.payments.length === 0 && (
            <p className={styles.empty}>Nothing paid in this period.</p>
          )}
        </div>
      </div>

      {receiptsPayments.totals.difference !== '0.00' && (
        <p className={styles.warning}>
          Opening plus receipts less payments does not reach the closing balance: difference{' '}
          {money(receiptsPayments.totals.difference)}.
        </p>
      )}
    </section>
  );
}
