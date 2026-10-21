import type { AgeingBucket, OutstandingsReport } from '@/entities/outstanding';
import { cn, formatMoney, toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';
import { StackedBars, Table } from '@/shared/ui';

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
  /** A figure in full, nil included — for the ageing bars, where a blank would read as unread. */
  figure: (value: string | number) => string;
  kind: 'receivable' | 'payable';
}

const BUCKETS: AgeingBucket[] = ['NOT_DUE', '0_30', '31_60', '61_90', 'OVER_90'];

/** How many parties the ageing chart lists before folding the rest into one row. */
const TOP_PARTIES = 8;

/**
 * What is still owed, bill by bill, with how long each one has been owed for.
 *
 * Receivables and payables are the same report read from either side, so they are one component —
 * two would drift, and an ageing band that means one thing on one screen and another on the other
 * is worse than no ageing at all.
 */
export function OutstandingsView({ outstandings, money, figure, kind }: OutstandingsViewProps) {
  /*
    Who owes what and for how long, party by party: each bill's outstanding added into its party's
    row under the band the bill is in. The largest first, and beyond the first eight the rest as one
    row — a chart of forty slivers is no chart.
  */
  const byParty = new Map<string, number[]>();
  for (const bill of outstandings.bills) {
    const parts = byParty.get(bill.ledgerName) ?? BUCKETS.map(() => 0);
    parts[BUCKETS.indexOf(bill.bucket)] += Number(bill.outstanding);
    byParty.set(bill.ledgerName, parts);
  }
  const total = (parts: number[]) => parts.reduce((sum, part) => sum + part, 0);
  const ranked = [...byParty.entries()]
    .map(([label, parts]) => ({ label, parts }))
    .sort((a, b) => total(b.parts) - total(a.parts));
  const rows = ranked.slice(0, TOP_PARTIES);
  if (ranked.length > TOP_PARTIES) {
    const rest = ranked.slice(TOP_PARTIES);
    rows.push({
      label: `${rest.length} more`,
      parts: BUCKETS.map((_, i) => rest.reduce((sum, row) => sum + row.parts[i], 0)),
    });
  }

  return (
    <section className={styles.panel}>
      {rows.length > 0 && (
        <div className={styles.ageing}>
          <h2 className={styles.chartTitle}>
            {kind === 'receivable' ? 'Owed to us' : 'Owed by us'}, by party and age
          </h2>
          <StackedBars
            rows={rows}
            buckets={BUCKETS.map((bucket) => BUCKET_LABELS[bucket])}
            formatValue={figure}
          />
        </div>
      )}
      <div className={styles.buckets}>
        {Object.entries(outstandings.totals.byBucket).map(([bucket, amount]) => (
          <div key={bucket} className={styles.bucket}>
            <span className={styles.bucketLabel}>{BUCKET_LABELS[bucket] ?? bucket}</span>
            <span className={styles.bucketAmount}>{money(amount)}</span>
          </div>
        ))}
        <div className={cn(styles.bucket, styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Total</span>
          <span className={styles.bucketAmount}>{money(outstandings.totals.outstanding)}</span>
        </div>
      </div>

      <Table surface="plain" sticky className={styles.tableWrap} stack>
        <thead>
          <tr>
            <th>Party</th>
            <th>Reference</th>
            <th>Due</th>
            <th data-num>Amount</th>
            <th data-num>Settled</th>
            <th data-num>Outstanding</th>
            <th data-num>Overdue</th>
          </tr>
        </thead>
        <tbody>
          {outstandings.bills.map((bill) => (
            <tr key={bill.billId}>
              <td>{bill.ledgerName}</td>
              <td>{bill.reference}</td>
              <td>{bill.dueDate ? toCalendarDay(bill.dueDate) : toCalendarDay(bill.billDate)}</td>
              <td data-num>
                {money(bill.amount)}
                {/*
                    A foreign bill is chased in the currency it was invoiced in. Showing only the
                    base figure left a New York client owing a rupee amount that appears nowhere on
                    the invoice, with nothing on the row to say it had been converted at all.
                  */}
                {bill.currencyCode && bill.fcAmount && (
                  <span className={styles.foreign}>
                    {bill.currencyCode} {formatMoney(bill.fcAmount)}
                  </span>
                )}
              </td>
              <td data-num>{money(bill.settled)}</td>
              <td data-num>
                {money(bill.outstanding)}
                {bill.currencyCode && bill.fcOutstanding && (
                  <span className={styles.foreign}>
                    {bill.currencyCode} {formatMoney(bill.fcOutstanding)}
                  </span>
                )}
              </td>
              <td data-num className={cn(bill.overdueDays > 0 && styles.figureNegative)}>
                {bill.overdueDays > 0 ? `${bill.overdueDays}d` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {outstandings.bills.length === 0 && (
        <p className={styles.empty}>
          Nothing outstanding as at {toCalendarDay(outstandings.asOf)}.
        </p>
      )}
    </section>
  );
}
