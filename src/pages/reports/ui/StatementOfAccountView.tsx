import type { StatementOfAccountReport } from '@/entities/report';
import { cn } from '@/shared/lib';

import { LedgerStatement } from './LedgerStatement';
import { Figure } from './Figure';
import styles from './ReportsPage.module.css';
import { Table } from '@/shared/ui';

interface StatementOfAccountViewProps {
  report: StatementOfAccountReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
}

/**
 * A party's movement and its open invoices, as one document.
 *
 * The thing that actually gets emailed when chasing payment, which is why it is one report rather
 * than two: a statement on its own invites "which invoice?", and a list of open invoices on its
 * own invites "what have I already paid?". The party's own details sit at the top because the
 * recipient has to recognise themselves before they will read anything below.
 */
export function StatementOfAccountView({ report, money, day }: StatementOfAccountViewProps) {
  const { party, totals } = report;
  const overdue = Number(totals.overdue) > 0;

  return (
    <>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>
          {party.name}
          <span className={styles.panelTotal}>
            <Figure amount={money(totals.closing)} side={totals.closingSide} />
          </span>
        </h2>
        <dl className={styles.partyFacts}>
          {party.gstin && (
            <div>
              <dt>GSTIN</dt>
              <dd>{party.gstin}</dd>
            </div>
          )}
          {party.pan && (
            <div>
              <dt>PAN</dt>
              <dd>{party.pan}</dd>
            </div>
          )}
          {party.creditDays !== undefined && (
            <div>
              <dt>Credit terms</dt>
              <dd>{party.creditDays} days</dd>
            </div>
          )}
          {party.creditLimit && (
            <div>
              <dt>Credit limit</dt>
              <dd>{money(party.creditLimit)}</dd>
            </div>
          )}
          {party.contactEmail && (
            <div>
              <dt>Email</dt>
              <dd>{party.contactEmail}</dd>
            </div>
          )}
          {party.address && (
            <div>
              <dt>Address</dt>
              <dd>{party.address}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className={styles.buckets}>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Balance</span>
          <span className={styles.bucketAmount}>{money(totals.closing)}</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Open invoices</span>
          <span className={styles.bucketAmount}>{money(totals.openTotal)}</span>
        </div>
        <div className={cn(styles.bucket, overdue && styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Of that, overdue</span>
          <span className={cn(styles.bucketAmount, overdue && styles.figureNegative)}>
            {money(totals.overdue)}
          </span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Not against an invoice</span>
          <span className={styles.bucketAmount}>{money(totals.unallocated)}</span>
        </div>
      </div>

      {report.openBills.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Open invoices</h2>
          <Table surface="plain" sticky className={styles.tableWrap} stack>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Dated</th>
                <th>Due</th>
                <th data-num>Invoiced</th>
                <th data-num>Paid</th>
                <th data-num>Outstanding</th>
                <th data-num>Overdue by</th>
              </tr>
            </thead>
            <tbody>
              {report.openBills.map((bill) => (
                <tr key={bill.billId}>
                  <td>{bill.reference}</td>
                  <td>{day(bill.billDate)}</td>
                  {/* An em dash, not a blank: an invoice with no due date is a fact. */}
                  <td>{bill.dueDate ? day(bill.dueDate) : '—'}</td>
                  <td data-num>{money(bill.amount)}</td>
                  <td data-num>{money(bill.settled)}</td>
                  <td data-num>{money(bill.outstanding)}</td>
                  <td data-num className={cn(bill.overdueDays > 0 && styles.figureNegative)}>
                    {bill.overdueDays > 0 ? `${bill.overdueDays} days` : 'Not due'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      <LedgerStatement statement={report.statement} money={money} day={day} />
    </>
  );
}
