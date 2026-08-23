import type { ForexGainLossReport } from '@/entities/currency';
import { cn, formatMoney } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface ForexViewProps {
  forex: ForexGainLossReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
}

/**
 * What the exchange rate has done to what is owed, realised and not.
 *
 * A bill settled at a different rate from the one it was raised at leaves a residue in the base
 * currency that is neither owed nor paid — that residue is the gain or the loss, and this is where
 * it is named rather than left sitting in a party's balance.
 */
export function ForexView({ forex, money, day }: ForexViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.buckets}>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Realised</span>
          <span className={styles.bucketAmount}>{money(forex.totals.realised)}</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Unrealised</span>
          <span className={styles.bucketAmount}>{money(forex.totals.unrealised)}</span>
        </div>
        <div className={cn(styles.bucket, styles.bucketTotal)}>
          <span className={styles.bucketLabel}>Unadjusted</span>
          <span className={styles.bucketAmount}>{money(forex.totals.unadjusted)}</span>
        </div>
      </div>

      <p className={styles.hint}>
        Nothing is posted automatically. Pass a journal moving this from{' '}
        <strong>Unadjusted Forex Gain/Loss</strong> to <strong>Forex Gain</strong> or{' '}
        <strong>Forex Loss</strong> once you accept the figures.
      </p>

      {forex.skippedForMissingRate.length > 0 && (
        <p className={styles.warning}>
          Left out for want of a rate on {day(forex.asOf)}: {forex.skippedForMissingRate.join(', ')}
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Party</th>
              <th>Reference</th>
              <th>Currency</th>
              {/* In the party's own currency — the column beside it names which. */}
              <th className={styles.num}>FC open</th>
              <th className={styles.num}>Booked</th>
              <th className={styles.num}>Revalued</th>
              <th className={styles.num}>Gain / loss</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {forex.lines.map((line) => (
              <tr key={line.billId}>
                <td>{line.ledgerName}</td>
                <td>{line.reference}</td>
                <td>{line.currencyCode}</td>
                <td className={styles.num}>{formatMoney(line.fcOutstanding)}</td>
                <td className={styles.num}>{money(line.bookedBase)}</td>
                <td className={styles.num}>{line.revaluedBase ? money(line.revaluedBase) : '—'}</td>
                <td className={cn(styles.num, Number(line.gainLoss) < 0 && styles.overdue)}>
                  {money(line.gainLoss)}
                </td>
                <td>{line.kind === 'REALISED' ? 'Realised' : 'Unrealised'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {forex.lines.length === 0 && (
        <p className={styles.empty}>No exchange differences as at {day(forex.asOf)}.</p>
      )}
    </section>
  );
}
