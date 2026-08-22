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
 * Every column goes through the same formatter. Movement used to be printed raw beside opening and
 * closing balances that were grouped and prefixed, so one table showed 15000.00 in one column and
 * ₹15,000.00 in the next — the same figure, twice, written two ways.
 *
 * Split out of the reports screen along with the other statements: each is a table with its own
 * columns and its own footing rule, and holding a dozen of them in one component made a file whose
 * top and bottom nobody could hold in mind at once.
 */
export function TrialBalanceView({ trialBalance, money, openLedger }: TrialBalanceViewProps) {
  /*
    Last year arrives as a debit and a credit, and is drawn as one column with the side written
    beside it — the way the trees show a prior figure. Two more numeric columns took this table
    past the width of its panel and clipped the last of them off the edge, and only one of the pair
    is ever non-nil anyway.
  */
  const prior = trialBalance.comparison;

  const priorCell = (debit: string | undefined, credit: string | undefined) => {
    // Absent, rather than nil: the ledger did not exist last year.
    if (debit === undefined && credit === undefined) return <td className={styles.numPrior}>—</td>;

    const onCredit = Number(credit ?? 0) > 0;
    return (
      <td className={styles.numPrior}>
        {money(onCredit ? (credit ?? '0.00') : (debit ?? '0.00'))}
        <span className={styles.priorSide}>{onCredit ? 'Cr' : 'Dr'}</span>
      </td>
    );
  };

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
              {prior && <th className={styles.numPrior}>FY {prior.financialYearLabel}</th>}
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
                <td className={styles.num}>{money(row.debit)}</td>
                <td className={styles.num}>{money(row.credit)}</td>
                <td className={styles.num}>{money(row.closingDebit)}</td>
                <td className={styles.num}>{money(row.closingCredit)}</td>
                {prior && priorCell(row.priorClosingDebit, row.priorClosingCredit)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className={styles.num}>{money(trialBalance.totals.openingDebit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.openingCredit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.debit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.credit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.closingDebit)}</td>
              <td className={styles.num}>{money(trialBalance.totals.closingCredit)}</td>
              {prior &&
                priorCell(
                  trialBalance.totals.priorClosingDebit,
                  trialBalance.totals.priorClosingCredit,
                )}
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
