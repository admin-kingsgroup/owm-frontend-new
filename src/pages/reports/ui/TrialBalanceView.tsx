import type { ReportNode, TrialBalanceReport } from '@/entities/report';

import styles from './ReportsPage.module.css';

interface TrialBalanceViewProps {
  trialBalance: TrialBalanceReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Opens the ledger behind a row. */
  openLedger: (node: ReportNode) => void;
}

/**
 * Every ledger with its opening, movement and closing, and the one figure that has to be zero.
 *
 * Split out of the reports screen along with the other statements: each is a table with its own
 * columns and its own footing rule, and holding a dozen of them in one component made a file whose
 * top and bottom nobody could hold in mind at once.
 */
export function TrialBalanceView({ trialBalance, money, openLedger }: TrialBalanceViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>Code</th>
              <th>Ledger</th>
              <th className={styles.num}>Opening Dr</th>
              <th className={styles.num}>Opening Cr</th>
              <th className={styles.num}>Debit</th>
              <th className={styles.num}>Credit</th>
              <th className={styles.num}>Closing Dr</th>
              <th className={styles.num}>Closing Cr</th>
            </tr>
          </thead>
          <tbody>
            {trialBalance.rows.map((row) => (
              <tr key={row.ledgerId}>
                <td>{row.code}</td>
                <td>
                  <button
                    type="button"
                    className={styles.linkCell}
                    onClick={() =>
                      openLedger({
                        kind: 'ledger',
                        id: row.ledgerId,
                        code: row.code,
                        name: row.name,
                        debit: row.debit,
                        credit: row.credit,
                        balance: row.closingDebit,
                        balanceSide: 'DEBIT',
                      })
                    }
                  >
                    {row.name}
                  </button>
                </td>
                <td className={styles.num}>{money(row.openingDebit)}</td>
                <td className={styles.num}>{money(row.openingCredit)}</td>
                <td className={styles.num}>{row.debit}</td>
                <td className={styles.num}>{row.credit}</td>
                <td className={styles.num}>{money(row.closingDebit)}</td>
                <td className={styles.num}>{money(row.closingCredit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className={styles.num}>{money(trialBalance.totals.openingDebit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.openingCredit)}</td>
              <td className={styles.num}>{trialBalance.totals.debit}</td>
              <td className={styles.num}>{trialBalance.totals.credit}</td>
              <td className={styles.num}>{money(trialBalance.totals.closingDebit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.closingCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {trialBalance.totals.difference !== '0.00' && (
        <p className={styles.warning}>
          Trial balance does not tie: difference {money(trialBalance.totals.difference)}.
        </p>
      )}
    </section>
  );
}
