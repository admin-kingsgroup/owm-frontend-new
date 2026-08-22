import type { LedgerStatementReport } from '@/entities/report';
import { toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface LedgerStatementProps {
  statement: LedgerStatementReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Shown above the postings when this is one of several statements on a page. */
  heading?: boolean;
}

/**
 * One account's postings, opening to closing.
 *
 * Drawn in two places — the drill-down from any figure on a statement, and the Cash and Bank books,
 * which are simply every cash or bank account's statement one after another. Extracted so those two
 * cannot drift: a running balance shown one way in a dialog and another way on a page is the kind of
 * difference that gets reconciled by hand for an hour before anyone notices it is the same data.
 */
export function LedgerStatement({ statement, money, heading = false }: LedgerStatementProps) {
  return (
    <div className={styles.statement}>
      {heading && (
        <h2 className={styles.statementTitle}>
          {statement.ledger.name}{' '}
          <span className={styles.statementCode}>{statement.ledger.code}</span>
        </h2>
      )}

      <div className={styles.statementHead}>
        <span>Opening</span>
        <span>
          {money(statement.openingBalance)} {statement.openingSide === 'DEBIT' ? 'Dr' : 'Cr'}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher</th>
              <th className={styles.num}>Debit</th>
              <th className={styles.num}>Credit</th>
              <th className={styles.num}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line, index) => (
              <tr key={`${line.voucherId}-${index}`}>
                <td>{toCalendarDay(line.voucherDate)}</td>
                <td>{line.voucherNumber}</td>
                <td className={styles.num}>{line.debit}</td>
                <td className={styles.num}>{line.credit}</td>
                <td className={styles.num}>{money(line.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {statement.lines.length === 0 && <p className={styles.empty}>No postings in this period.</p>}

      <div className={styles.statementHead}>
        <span>Closing</span>
        <span>
          {money(statement.closingBalance)} {statement.closingSide === 'DEBIT' ? 'Dr' : 'Cr'}
        </span>
      </div>
    </div>
  );
}
