import type { LedgerStatementReport } from '@/entities/report';

import { LineChart } from '@/shared/ui';
import { formatCompactMoney } from '@/shared/lib';

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
  /** Draws the balance as a line above the postings — for the statement opened on its own. */
  chart?: boolean;
  /** The company's country, for the chart's short axis figures. */
  country?: string;
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
export function LedgerStatement({
  statement,
  money,
  day,
  heading = false,
  chart = false,
  country,
}: LedgerStatementProps) {
  return (
    <div className={styles.statement}>
      {heading && (
        <h2 className={styles.statementTitle}>
          {statement.ledger.name}{' '}
          <span className={styles.statementCode}>{statement.ledger.code}</span>
        </h2>
      )}

      {/*
        The balance after every posting, as a line — where the account went and when. Only on the
        statement opened on its own; the cash and bank books stack many of these, and a chart over
        each would bury the postings they exist to list.
      */}
      {chart && statement.lines.length > 1 && (
        <div className={styles.statementChart}>
          <LineChart
            area
            zero={false}
            height={190}
            labels={statement.lines.map((line) => day(line.voucherDate))}
            tooltipLabels={statement.lines.map(
              (line) => `${day(line.voucherDate)} · ${line.voucherNumber}`,
            )}
            series={[
              {
                label: 'Balance',
                color: 'var(--series-1)',
                values: statement.lines.map((line) => Number(line.runningBalance)),
              },
            ]}
            formatValue={(value) => money(String(value)) || '0'}
            formatAxis={(value) => formatCompactMoney(value, { country })}
            caption={`${statement.ledger.name}: the balance after each posting`}
          />
        </div>
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
