import type { BankReconciliationReport } from '@/entities/report';
import { cn } from '@/shared/lib';

import { Figure } from './Figure';
import styles from './ReportsPage.module.css';
import { Table } from '@/shared/ui';

interface BankReconciliationViewProps {
  report: BankReconciliationReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
  /** What a voucher type is called, in the company's own words, given its code. */
  typeName: (code: string) => string;
  /**
   * Ticks a line off against the statement, or clears the mark when the date is emptied.
   *
   * The date is the day the bank showed it, not the day somebody sat down to reconcile: a
   * statement run for last month must not be told about a line cleared this month, or the figure
   * it derives cannot be checked against the paper it came from.
   */
  onReconcile: (voucherId: string, entryId: string, bankDate: string | null) => void;
  /** True while a mark is being saved, so the row cannot be ticked twice. */
  saving: boolean;
}

/**
 * Why the bank and the books disagree, and what the bank should therefore be showing.
 *
 * The two figures are set at either end with the reasons between them, because that is the shape
 * of the question: the difference is never a mystery, it is exactly these lines. The bank's
 * balance is derived rather than entered, so a reader can hold it against the statement in hand —
 * and if it still does not match, something is genuinely missing rather than merely late.
 */
export function BankReconciliationView({
  report,
  money,
  onReconcile,
  saving,
  day,
  typeName,
}: BankReconciliationViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.buckets}>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Balance as per books</span>
          <span className={styles.bucketAmount}>
            <Figure amount={money(report.balanceAsPerBooks)} side={report.balanceAsPerBooksSide} />
          </span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Deposits not yet credited</span>
          <span className={styles.bucketAmount}>
            <Figure amount={money(report.totals.unreconciledDebits)} />
          </span>
          <span className={styles.bucketPrior}>lowers the bank&rsquo;s figure</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Cheques not yet presented</span>
          <span className={styles.bucketAmount}>
            <Figure amount={money(report.totals.unreconciledCredits)} />
          </span>
          <span className={styles.bucketPrior}>raises the bank&rsquo;s figure</span>
        </div>
        <div className={cn(styles.bucket, styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Balance as per bank</span>
          <span className={styles.bucketAmount}>
            <Figure
              amount={money(report.totals.balanceAsPerBank)}
              side={report.totals.balanceAsPerBankSide}
            />
          </span>
        </div>
      </div>

      <p className={styles.hint}>
        Put the date the bank showed a line against it and the line leaves this list. Hold the last
        figure against the statement the bank sent. If the two agree, everything still listed is
        simply in transit. If they do not, something is missing from one side or the other.
      </p>

      <h2 className={styles.panelTitle}>
        Not yet on the statement
        <span className={styles.panelTotal}>
          {report.unreconciled.length} line{report.unreconciled.length === 1 ? '' : 's'}
        </span>
      </h2>

      <Table surface="plain" sticky className={styles.tableWrap} stack>
        <thead>
          <tr>
            <th>Date</th>
            <th>Number</th>
            <th>Type</th>
            <th>Instrument</th>
            <th>Narration</th>
            <th data-num>Debit</th>
            <th data-num>Credit</th>
            <th>Bank date</th>
          </tr>
        </thead>
        <tbody>
          {report.unreconciled.map((row) => (
            <tr key={`${row.voucherId}-${row.instrumentNumber ?? ''}-${row.debit}${row.credit}`}>
              <td>{day(row.voucherDate)}</td>
              <td>{row.voucherNumber}</td>
              <td>{typeName(row.voucherTypeCode)}</td>
              {/* An em dash, not a blank: a line with no instrument is a fact, not a gap. */}
              <td>{row.instrumentNumber ?? '—'}</td>
              <td>{row.narration ?? '—'}</td>
              <td data-num>{money(row.debit)}</td>
              <td data-num>{money(row.credit)}</td>
              <td>
                {/*
                    Typing the day the bank showed it is the whole of reconciling, exactly as it is
                    on paper: the line leaves this list the moment it has a date.
                  */}
                <input
                  type="date"
                  className={styles.select}
                  aria-label={`Bank date for ${row.voucherNumber}`}
                  disabled={saving}
                  defaultValue=""
                  onChange={(event) =>
                    onReconcile(row.voucherId, row.entryId, event.target.value || null)
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {report.unreconciled.length === 0 && (
        <p className={styles.empty}>
          Everything posted to this account up to {day(report.asOf)} has been shown by the bank. The
          two balances agree.
        </p>
      )}
    </section>
  );
}
