import type { LedgerStatementReport } from '@/entities/report';

import { Figure } from './Figure';
import styles from './ReportsPage.module.css';
import { Table } from '@/shared/ui';

interface LedgerStatementProps {
  statement: LedgerStatementReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
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
 *
 * Movement goes through the same formatter as the balances beside it. Printed raw it read 15000.00
 * next to ₹15,000.00 — one figure, one table, two ways of writing it.
 */
export function LedgerStatement({ statement, money, day, heading = false }: LedgerStatementProps) {
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
          <Figure amount={money(statement.openingBalance)} side={statement.openingSide} />
        </span>
      </div>

      <Table surface="plain" sticky className={styles.tableWrap} stack>
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher</th>
            <th data-num>Debit</th>
            <th data-num>Credit</th>
            <th data-num>Balance</th>
          </tr>
        </thead>
        <tbody>
          {statement.lines.map((line, index) => (
            <tr key={`${line.voucherId}-${index}`}>
              <td>{day(line.voucherDate)}</td>
              <td>{line.voucherNumber}</td>
              <td data-num>{money(line.debit)}</td>
              <td data-num>{money(line.credit)}</td>
              <td data-num>{money(line.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      {statement.lines.length === 0 && <p className={styles.empty}>No postings in this period.</p>}

      <div className={styles.statementHead}>
        <span>Closing</span>
        <span>
          <Figure amount={money(statement.closingBalance)} side={statement.closingSide} />
        </span>
      </div>
    </div>
  );
}
