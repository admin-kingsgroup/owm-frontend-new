import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';

import {
  getBalanceSheet,
  getDayBook,
  getLedgerStatement,
  getProfitAndLoss,
  getTrialBalance,
} from '@/entities/report';
import type {
  BalanceSheetReport,
  DayBookReport,
  LedgerStatementReport,
  ProfitAndLossReport,
  ReportNode,
  TrialBalanceReport,
} from '@/entities/report';
import { Loading, Modal } from '@/shared/ui';
import { cn, getErrorMessage } from '@/shared/lib';

import { ReportTree } from './ReportTree';
import styles from './ReportsPage.module.css';

type Tab = 'balance-sheet' | 'profit-loss' | 'trial-balance' | 'day-book';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'profit-loss', label: 'Profit & Loss' },
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'day-book', label: 'Day Book' },
];

const asDay = (value: string) => value.slice(0, 10);

export function ReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [tab, setTab] = useState<Tab>('balance-sheet');

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitAndLossReport | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [dayBook, setDayBook] = useState<DayBookReport | null>(null);

  const [statement, setStatement] = useState<LedgerStatementReport | null>(null);
  const [loading, setLoading] = useState(true);
  /** Only a failed initial load replaces the page; anything later is shown without losing it. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        // All four are fetched together: they share a period, and switching tabs should not wait
        // on a round trip for a figure the user is comparing against the one already on screen.
        const [bs, pl, tb, db] = await Promise.all([
          getBalanceSheet(id),
          getProfitAndLoss(id),
          getTrialBalance(id),
          getDayBook(id),
        ]);
        if (cancelled) return;
        setBalanceSheet(bs);
        setProfitLoss(pl);
        setTrialBalance(tb);
        setDayBook(db);
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Could not load reports'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const openLedger = useCallback(
    async (node: ReportNode) => {
      if (!companyId) return;
      try {
        setStatement(await getLedgerStatement(companyId, node.id));
      } catch (err) {
        setError(getErrorMessage(err, 'Could not open ledger'));
      }
    },
    [companyId],
  );

  if (!companyId) return null;
  if (loading) return <Loading label="Loading reports…" />;
  if (loadError) return <p className={styles.error}>{loadError}</p>;

  const period = balanceSheet?.period;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reports</h1>
        {period && (
          <p className={styles.subtitle}>
            FY {period.financialYearLabel} · {asDay(period.from)} to {asDay(period.to)}
          </p>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.tabs}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={cn(styles.tab, tab === entry.id && styles.tabActive)}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'balance-sheet' && balanceSheet && (
        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Assets <span className={styles.panelTotal}>{balanceSheet.totals.assets}</span>
            </h2>
            <ReportTree nodes={balanceSheet.assets} onSelectLedger={openLedger} />
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Liabilities{' '}
              <span className={styles.panelTotal}>{balanceSheet.totals.liabilities}</span>
            </h2>
            <ReportTree nodes={balanceSheet.liabilities} onSelectLedger={openLedger} />
            <div className={styles.derivedRow}>
              <span>Profit for the period</span>
              <span>{balanceSheet.totals.currentPeriodProfit}</span>
            </div>
            {balanceSheet.totals.difference !== '0.00' && (
              <p className={styles.warning}>
                Out of balance by {balanceSheet.totals.difference}. Check opening balances.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'profit-loss' && profitLoss && (
        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Income <span className={styles.panelTotal}>{profitLoss.totals.income}</span>
            </h2>
            <ReportTree nodes={profitLoss.income} onSelectLedger={openLedger} />
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Expenses <span className={styles.panelTotal}>{profitLoss.totals.expenses}</span>
            </h2>
            <ReportTree nodes={profitLoss.expenses} onSelectLedger={openLedger} />
            <div className={styles.derivedRow}>
              <span>{Number(profitLoss.totals.netProfit) < 0 ? 'Net loss' : 'Net profit'}</span>
              <span>{profitLoss.totals.netProfit}</span>
            </div>
          </section>
        </div>
      )}

      {tab === 'trial-balance' && trialBalance && (
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
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
                    <td className={styles.num}>{row.openingDebit}</td>
                    <td className={styles.num}>{row.openingCredit}</td>
                    <td className={styles.num}>{row.debit}</td>
                    <td className={styles.num}>{row.credit}</td>
                    <td className={styles.num}>{row.closingDebit}</td>
                    <td className={styles.num}>{row.closingCredit}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className={styles.num}>{trialBalance.totals.openingDebit}</td>
                  <td className={styles.num}>{trialBalance.totals.openingCredit}</td>
                  <td className={styles.num}>{trialBalance.totals.debit}</td>
                  <td className={styles.num}>{trialBalance.totals.credit}</td>
                  <td className={styles.num}>{trialBalance.totals.closingDebit}</td>
                  <td className={styles.num}>{trialBalance.totals.closingCredit}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {trialBalance.totals.difference !== '0.00' && (
            <p className={styles.warning}>
              Trial balance does not tie: difference {trialBalance.totals.difference}.
            </p>
          )}
        </section>
      )}

      {tab === 'day-book' && dayBook && (
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Narration</th>
                  <th className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dayBook.rows.map((row) => (
                  <tr key={row.voucherId}>
                    <td>{asDay(row.voucherDate)}</td>
                    <td>{row.voucherNumber}</td>
                    <td>{row.voucherTypeCode}</td>
                    <td>{row.narration ?? '—'}</td>
                    <td className={styles.num}>{row.amount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className={styles.num}>{dayBook.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {dayBook.rows.length === 0 && <p className={styles.empty}>No vouchers in this period.</p>}
        </section>
      )}

      <Modal
        open={statement !== null}
        onClose={() => setStatement(null)}
        title={statement ? `${statement.ledger.name} (${statement.ledger.code})` : ''}
      >
        {statement && (
          <div className={styles.statement}>
            <div className={styles.statementHead}>
              <span>Opening</span>
              <span>
                {statement.openingBalance} {statement.openingSide === 'DEBIT' ? 'Dr' : 'Cr'}
              </span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
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
                      <td>{asDay(line.voucherDate)}</td>
                      <td>{line.voucherNumber}</td>
                      <td className={styles.num}>{line.debit}</td>
                      <td className={styles.num}>{line.credit}</td>
                      <td className={styles.num}>{line.runningBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {statement.lines.length === 0 && (
              <p className={styles.empty}>No postings in this period.</p>
            )}
            <div className={styles.statementHead}>
              <span>Closing</span>
              <span>
                {statement.closingBalance} {statement.closingSide === 'DEBIT' ? 'Dr' : 'Cr'}
              </span>
            </div>
            <button type="button" className={styles.closeLink} onClick={() => setStatement(null)}>
              <X size={14} /> Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
