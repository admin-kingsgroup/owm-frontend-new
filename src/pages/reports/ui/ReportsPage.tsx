import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Printer, X } from 'lucide-react';

import { getCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import {
  getBalanceSheet,
  getDayBook,
  getLedgerStatement,
  getProfitAndLoss,
  getTrialBalance,
  getReceiptsAndPayments,
  getCashFlow,
} from '@/entities/report';
import type {
  BalanceSheetReport,
  DayBookReport,
  LedgerStatementReport,
  ProfitAndLossReport,
  ReportNode,
  TrialBalanceReport,
  ReceiptsAndPaymentsReport,
  CashFlowReport,
} from '@/entities/report';
import { getPayables, getReceivables } from '@/entities/outstanding';
import type { OutstandingsReport } from '@/entities/outstanding';
import { getForexGainLoss } from '@/entities/currency';
import type { ForexGainLossReport } from '@/entities/currency';
import { Button, Input, Loading, Modal, Checkbox, ColumnChart } from '@/shared/ui';
import { cn, getErrorMessage, formatMoney, localeFor } from '@/shared/lib';

import { ReportTree } from './ReportTree';
import { downloadCsv, flattenNodes } from './export-csv';
import styles from './ReportsPage.module.css';

type Tab =
  | 'balance-sheet'
  | 'profit-loss'
  | 'trial-balance'
  | 'day-book'
  | 'receipts-payments'
  | 'cash-flow'
  | 'receivables'
  | 'payables'
  | 'forex';

const BUCKET_LABELS: Record<string, string> = {
  NOT_DUE: 'Not due',
  '0_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  OVER_90: 'Over 90 days',
};

const asDay = (value: string) => value.slice(0, 10);

export function ReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [tab, setTab] = useState<Tab>('balance-sheet');

  // Empty means "the whole financial year", which is what the server defaults to.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [compare, setCompare] = useState(false);
  const [applied, setApplied] = useState({ from: '', to: '', compare: false });

  const [company, setCompany] = useState<Company | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitAndLossReport | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [dayBook, setDayBook] = useState<DayBookReport | null>(null);
  const [receiptsPayments, setReceiptsPayments] = useState<ReceiptsAndPaymentsReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [receivables, setReceivables] = useState<OutstandingsReport | null>(null);
  const [payables, setPayables] = useState<OutstandingsReport | null>(null);
  const [forex, setForex] = useState<ForexGainLossReport | null>(null);

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
        const params = {
          from: applied.from || undefined,
          to: applied.to || undefined,
          compare: applied.compare || undefined,
        };
        // `asOf` for the ageing reports is the end of the period being looked at.
        const asOf = applied.to || undefined;

        const [companyResult, bs, pl, tb, db, rp, cf, rec, pay] = await Promise.all([
          getCompany(id),
          getBalanceSheet(id, params),
          getProfitAndLoss(id, params),
          getTrialBalance(id, params),
          getDayBook(id, params),
          getReceiptsAndPayments(id, params),
          getCashFlow(id, params),
          getReceivables(id, asOf),
          getPayables(id, asOf),
        ]);
        if (cancelled) return;

        setCompany(companyResult);
        setBalanceSheet(bs);
        setProfitLoss(pl);
        setTrialBalance(tb);
        setDayBook(db);
        setReceiptsPayments(rp);
        setCashFlow(cf);
        setReceivables(rec);
        setPayables(pay);

        // Only meaningful once the company transacts in more than one currency.
        setForex(companyResult.features.multiCurrency ? await getForexGainLoss(id, asOf) : null);
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
  }, [companyId, applied]);

  const openLedger = useCallback(
    async (node: ReportNode) => {
      if (!companyId) return;
      try {
        setStatement(
          await getLedgerStatement(companyId, node.id, {
            from: applied.from || undefined,
            to: applied.to || undefined,
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, 'Could not open ledger'));
      }
    },
    [companyId, applied],
  );

  function exportCurrentTab() {
    const stamp = balanceSheet ? balanceSheet.period.financialYearLabel : 'report';
    const name = (label: string) => `${label}-${stamp}.csv`;
    const treeHeaders = ['Name', 'Code', 'Kind', 'Debit', 'Credit', 'Balance', 'Side'];

    if (tab === 'balance-sheet' && balanceSheet) {
      downloadCsv(name('balance-sheet'), treeHeaders, [
        ['ASSETS', '', '', '', '', balanceSheet.totals.assets, 'DEBIT'],
        ...flattenNodes(balanceSheet.assets),
        ['LIABILITIES', '', '', '', '', balanceSheet.totals.liabilities, 'CREDIT'],
        ...flattenNodes(balanceSheet.liabilities),
        ['Profit for the period', '', '', '', '', balanceSheet.totals.currentPeriodProfit, ''],
      ]);
    } else if (tab === 'profit-loss' && profitLoss) {
      downloadCsv(name('profit-and-loss'), treeHeaders, [
        ['INCOME', '', '', '', '', profitLoss.totals.income, 'CREDIT'],
        ...flattenNodes(profitLoss.income),
        ['EXPENSES', '', '', '', '', profitLoss.totals.expenses, 'DEBIT'],
        ...flattenNodes(profitLoss.expenses),
        ['Net profit', '', '', '', '', profitLoss.totals.netProfit, ''],
      ]);
    } else if (tab === 'trial-balance' && trialBalance) {
      downloadCsv(
        name('trial-balance'),
        [
          'Code',
          'Ledger',
          'Opening Dr',
          'Opening Cr',
          'Debit',
          'Credit',
          'Closing Dr',
          'Closing Cr',
        ],
        [
          ...trialBalance.rows.map((row) => [
            row.code,
            row.name,
            row.openingDebit,
            row.openingCredit,
            row.debit,
            row.credit,
            row.closingDebit,
            row.closingCredit,
          ]),
          [
            '',
            'Total',
            trialBalance.totals.openingDebit,
            trialBalance.totals.openingCredit,
            trialBalance.totals.debit,
            trialBalance.totals.credit,
            trialBalance.totals.closingDebit,
            trialBalance.totals.closingCredit,
          ],
        ],
      );
    } else if (tab === 'day-book' && dayBook) {
      downloadCsv(
        name('day-book'),
        ['Date', 'Number', 'Type', 'Narration', 'Amount'],
        dayBook.rows.map((row) => [
          asDay(row.voucherDate),
          row.voucherNumber,
          row.voucherTypeCode,
          row.narration ?? '',
          row.amount,
        ]),
      );
    } else if (tab === 'receipts-payments' && receiptsPayments) {
      downloadCsv(
        name('receipts-and-payments'),
        ['Section', 'Code', 'Ledger', 'Amount'],
        [
          ['Opening', '', '', receiptsPayments.openingBalance],
          ...receiptsPayments.receipts.map((row) => ['Receipt', row.code, row.name, row.amount]),
          ...receiptsPayments.payments.map((row) => ['Payment', row.code, row.name, row.amount]),
          ['Closing', '', '', receiptsPayments.closingBalance],
        ],
      );
    } else if (tab === 'cash-flow' && cashFlow) {
      downloadCsv(name('cash-flow'), treeHeaders, [
        ['INFLOW', '', '', '', '', cashFlow.totals.inflow, 'DEBIT'],
        ...flattenNodes(cashFlow.inflow),
        ['OUTFLOW', '', '', '', '', cashFlow.totals.outflow, 'CREDIT'],
        ...flattenNodes(cashFlow.outflow),
        ['Net change', '', '', '', '', cashFlow.totals.netChange, ''],
      ]);
    } else if ((tab === 'receivables' || tab === 'payables') && (receivables || payables)) {
      const report = tab === 'receivables' ? receivables : payables;
      if (!report) return;
      downloadCsv(
        name(tab),
        [
          'Party',
          'Reference',
          'Bill date',
          'Due date',
          'Amount',
          'Settled',
          'Outstanding',
          'Days overdue',
        ],
        report.bills.map((bill) => [
          bill.ledgerName,
          bill.reference,
          asDay(bill.billDate),
          bill.dueDate ? asDay(bill.dueDate) : '',
          bill.amount,
          bill.settled,
          bill.outstanding,
          String(bill.overdueDays),
        ]),
      );
    } else if (tab === 'forex' && forex) {
      downloadCsv(
        name('forex-gain-loss'),
        [
          'Party',
          'Reference',
          'Currency',
          'FC outstanding',
          'Booked',
          'Revalued',
          'Gain/Loss',
          'Kind',
        ],
        forex.lines.map((line) => [
          line.ledgerName,
          line.reference,
          line.currencyCode,
          line.fcOutstanding,
          line.bookedBase,
          line.revaluedBase ?? '',
          line.gainLoss,
          line.kind,
        ]),
      );
    }
  }

  /**
   * "Apr", "May" — short enough that twelve fit across a chart, and in the reader's own language.
   * The day is fixed at the first of the month, which is what the API sends.
   */
  const monthLabel = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(localeFor(company?.country), {
        month: 'short',
        timeZone: 'UTC',
      }),
    [company],
  );

  /**
   * Every figure on this screen goes through here.
   *
   * The overview cards were formatting amounts and these tables were not, so the same balance read
   * as two different numbers depending on which screen you were on. Grouping follows the company's
   * own country, not the browser's — 51,76,350 rather than 5,176,350 for an Indian company opened
   * on an en-US machine.
   *
   * The CSV export deliberately does NOT use this: a spreadsheet needs the raw decimal, and a
   * grouped, symbol-prefixed string imports as text.
   */
  const money = useCallback(
    // string from the API, number from the chart — formatMoney takes either.
    (value: string | number) =>
      formatMoney(value, { currency: company?.baseCurrency, country: company?.country }),
    [company],
  );

  if (!companyId) return null;
  if (loading) return <Loading label="Loading reports…" />;
  if (loadError) return <p className={styles.error}>{loadError}</p>;

  const period = balanceSheet?.period;

  const TABS: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'balance-sheet', label: 'Balance Sheet', show: true },
    { id: 'profit-loss', label: 'Profit & Loss', show: true },
    { id: 'trial-balance', label: 'Trial Balance', show: true },
    { id: 'day-book', label: 'Day Book', show: true },
    { id: 'receipts-payments', label: 'Receipts & Payments', show: true },
    { id: 'cash-flow', label: 'Cash Flow', show: true },
    { id: 'receivables', label: 'Receivables', show: Boolean(company?.features.billWiseDetails) },
    { id: 'payables', label: 'Payables', show: Boolean(company?.features.billWiseDetails) },
    { id: 'forex', label: 'Forex Gain/Loss', show: Boolean(company?.features.multiCurrency) },
  ];

  const outstandings = tab === 'receivables' ? receivables : payables;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          {period && (
            <p className={styles.subtitle}>
              FY {period.financialYearLabel} · {asDay(period.from)} to {asDay(period.to)}
            </p>
          )}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.periodField}>
            <label className={styles.periodLabel} htmlFor="report-from">
              From
            </label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className={styles.periodField}>
            <label className={styles.periodLabel} htmlFor="report-to">
              To
            </label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          {/*
            Applied with the period rather than on its own, because asking for it re-fetches both
            statements — and because a comparison only means anything against a stated span.
          */}
          <div className={styles.compareField}>
            <Checkbox
              id="report-compare"
              label="Compare with last year"
              checked={compare}
              onChange={(event) => setCompare(event.target.checked)}
            />
          </div>
          <Button variant="secondary" onClick={() => setApplied({ from, to, compare })}>
            Apply
          </Button>
          {(applied.from || applied.to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
                setApplied({ from: '', to: '', compare });
              }}
            >
              Whole year
            </Button>
          )}
          <Button variant="ghost" onClick={exportCurrentTab} title="Download this report as CSV">
            <Download size={14} /> CSV
          </Button>
          <Button variant="ghost" onClick={() => window.print()} title="Print this report">
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {applied.compare && (tab === 'balance-sheet' || tab === 'profit-loss') && (
        <p className={styles.hint} role="status">
          {(tab === 'balance-sheet' ? balanceSheet?.comparison : profitLoss?.comparison)
            ? `Compared with FY ${(tab === 'balance-sheet' ? balanceSheet : profitLoss)?.comparison?.financialYearLabel}.`
            : 'No comparison available — this is the first financial year, or the period is not a whole one.'}
        </p>
      )}

      <div className={styles.tabs}>
        {TABS.filter((entry) => entry.show).map((entry) => (
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
              Assets
              {balanceSheet.totals.priorAssets !== undefined && (
                <span className={styles.panelPrior}>{money(balanceSheet.totals.priorAssets)}</span>
              )}
              <span className={styles.panelTotal}>{money(balanceSheet.totals.assets)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={balanceSheet.assets}
              onSelectLedger={openLedger}
              showPrior={Boolean(balanceSheet.comparison)}
            />
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Liabilities{' '}
              {balanceSheet.totals.priorLiabilities !== undefined && (
                <span className={styles.panelPrior}>
                  {money(balanceSheet.totals.priorLiabilities)}
                </span>
              )}
              <span className={styles.panelTotal}>{money(balanceSheet.totals.liabilities)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={balanceSheet.liabilities}
              onSelectLedger={openLedger}
              showPrior={Boolean(balanceSheet.comparison)}
            />
            <div className={styles.derivedRow}>
              <span>Profit for the period</span>
              <span>
                {balanceSheet.totals.priorCurrentPeriodProfit !== undefined && (
                  <span className={styles.panelPrior}>
                    {money(balanceSheet.totals.priorCurrentPeriodProfit)}
                  </span>
                )}
                {money(balanceSheet.totals.currentPeriodProfit)}
              </span>
            </div>
            {balanceSheet.totals.difference !== '0.00' && (
              <p className={styles.warning}>
                Out of balance by {money(balanceSheet.totals.difference)}. Check opening balances.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'profit-loss' && profitLoss && profitLoss.monthly.length > 0 && (
        <section className={styles.chartPanel}>
          <h2 className={styles.chartTitle}>Month by month</h2>
          <ColumnChart
            labels={profitLoss.monthly.map((month) => monthLabel(month.month))}
            formatValue={money}
            caption="Income and expenses for each month of the period"
            series={[
              {
                label: 'Income',
                color: 'var(--data-1)',
                values: profitLoss.monthly.map((month) => Number(month.income)),
              },
              {
                label: 'Expenses',
                color: 'var(--data-2)',
                values: profitLoss.monthly.map((month) => Number(month.expenses)),
              },
            ]}
          />
        </section>
      )}

      {tab === 'profit-loss' && profitLoss && (
        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Income
              {profitLoss.totals.priorIncome !== undefined && (
                <span className={styles.panelPrior}>{money(profitLoss.totals.priorIncome)}</span>
              )}
              <span className={styles.panelTotal}>{money(profitLoss.totals.income)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={profitLoss.income}
              onSelectLedger={openLedger}
              showPrior={Boolean(profitLoss.comparison)}
            />
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Expenses{' '}
              {profitLoss.totals.priorExpenses !== undefined && (
                <span className={styles.panelPrior}>{money(profitLoss.totals.priorExpenses)}</span>
              )}
              <span className={styles.panelTotal}>{money(profitLoss.totals.expenses)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={profitLoss.expenses}
              onSelectLedger={openLedger}
              showPrior={Boolean(profitLoss.comparison)}
            />
            <div className={styles.derivedRow}>
              <span>{Number(profitLoss.totals.netProfit) < 0 ? 'Net loss' : 'Net profit'}</span>
              <span>
                {profitLoss.totals.priorNetProfit !== undefined && (
                  <span className={styles.panelPrior}>
                    {money(profitLoss.totals.priorNetProfit)}
                  </span>
                )}
                {money(profitLoss.totals.netProfit)}
              </span>
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
                    <td className={styles.num}>{money(row.amount)}</td>
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

      {tab === 'receipts-payments' && receiptsPayments && (
        <section className={styles.panel}>
          <div className={styles.buckets}>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Opening</span>
              <span className={styles.bucketAmount}>{money(receiptsPayments.openingBalance)}</span>
            </div>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Receipts</span>
              <span className={styles.bucketAmount}>{receiptsPayments.totals.receipts}</span>
            </div>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Payments</span>
              <span className={styles.bucketAmount}>{receiptsPayments.totals.payments}</span>
            </div>
            <div className={cn(styles.bucket, styles.bucketTotal)}>
              <span className={styles.bucketLabel}>Closing</span>
              <span className={styles.bucketAmount}>{money(receiptsPayments.closingBalance)}</span>
            </div>
          </div>

          <p className={styles.hint}>
            Only money that actually moved. An invoice raised but unpaid is income, so it appears on
            the Profit &amp; Loss and not here.
          </p>

          <div className={styles.twoColumn}>
            <div>
              <h2 className={styles.panelTitle}>
                Receipts{' '}
                <span className={styles.panelTotal}>{receiptsPayments.totals.receipts}</span>
              </h2>
              <table className={styles.table}>
                <tbody>
                  {receiptsPayments.receipts.map((row) => (
                    <tr key={`r-${row.ledgerId}`}>
                      <td>{row.name}</td>
                      <td className={styles.num}>{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {receiptsPayments.receipts.length === 0 && (
                <p className={styles.empty}>Nothing received in this period.</p>
              )}
            </div>
            <div>
              <h2 className={styles.panelTitle}>
                Payments{' '}
                <span className={styles.panelTotal}>{receiptsPayments.totals.payments}</span>
              </h2>
              <table className={styles.table}>
                <tbody>
                  {receiptsPayments.payments.map((row) => (
                    <tr key={`p-${row.ledgerId}`}>
                      <td>{row.name}</td>
                      <td className={styles.num}>{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {receiptsPayments.payments.length === 0 && (
                <p className={styles.empty}>Nothing paid in this period.</p>
              )}
            </div>
          </div>

          {receiptsPayments.totals.difference !== '0.00' && (
            <p className={styles.warning}>
              Opening plus receipts less payments does not reach the closing balance: difference{' '}
              {money(receiptsPayments.totals.difference)}.
            </p>
          )}
        </section>
      )}

      {tab === 'cash-flow' && cashFlow && cashFlow.monthly.length > 0 && (
        <section className={styles.chartPanel}>
          <h2 className={styles.chartTitle}>Month by month</h2>
          <ColumnChart
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            formatValue={money}
            caption="Cash in and cash out for each month of the period"
            series={[
              {
                label: 'Cash in',
                color: 'var(--data-1)',
                values: cashFlow.monthly.map((month) => Number(month.inflow)),
              },
              {
                label: 'Cash out',
                color: 'var(--data-2)',
                values: cashFlow.monthly.map((month) => Number(month.outflow)),
              },
              {
                label: 'Net',
                color: 'var(--data-3)',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
            ]}
          />
        </section>
      )}

      {tab === 'cash-flow' && cashFlow && (
        <>
          <div className={styles.buckets}>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Opening</span>
              <span className={styles.bucketAmount}>{money(cashFlow.openingBalance)}</span>
            </div>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Net change</span>
              <span className={styles.bucketAmount}>{money(cashFlow.totals.netChange)}</span>
            </div>
            <div className={cn(styles.bucket, styles.bucketTotal)}>
              <span className={styles.bucketLabel}>Closing</span>
              <span className={styles.bucketAmount}>{money(cashFlow.closingBalance)}</span>
            </div>
          </div>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>
                Cash in <span className={styles.panelTotal}>{money(cashFlow.totals.inflow)}</span>
              </h2>
              <ReportTree
                formatAmount={money}
                nodes={cashFlow.inflow}
                onSelectLedger={openLedger}
              />
            </section>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>
                Cash out <span className={styles.panelTotal}>{money(cashFlow.totals.outflow)}</span>
              </h2>
              <ReportTree
                formatAmount={money}
                nodes={cashFlow.outflow}
                onSelectLedger={openLedger}
              />
            </section>
          </div>
        </>
      )}

      {(tab === 'receivables' || tab === 'payables') && outstandings && (
        <section className={styles.panel}>
          <div className={styles.buckets}>
            {Object.entries(outstandings.totals.byBucket).map(([bucket, amount]) => (
              <div key={bucket} className={styles.bucket}>
                <span className={styles.bucketLabel}>{BUCKET_LABELS[bucket] ?? bucket}</span>
                <span className={styles.bucketAmount}>{amount}</span>
              </div>
            ))}
            <div className={cn(styles.bucket, styles.bucketTotal)}>
              <span className={styles.bucketLabel}>Total</span>
              <span className={styles.bucketAmount}>{outstandings.totals.outstanding}</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Reference</th>
                  <th>Due</th>
                  <th className={styles.num}>Amount</th>
                  <th className={styles.num}>Settled</th>
                  <th className={styles.num}>Outstanding</th>
                  <th className={styles.num}>Overdue</th>
                </tr>
              </thead>
              <tbody>
                {outstandings.bills.map((bill) => (
                  <tr key={bill.billId}>
                    <td>{bill.ledgerName}</td>
                    <td>{bill.reference}</td>
                    <td>{bill.dueDate ? asDay(bill.dueDate) : asDay(bill.billDate)}</td>
                    <td className={styles.num}>{money(bill.amount)}</td>
                    <td className={styles.num}>{bill.settled}</td>
                    <td className={styles.num}>{bill.outstanding}</td>
                    <td className={cn(styles.num, bill.overdueDays > 0 && styles.overdue)}>
                      {bill.overdueDays > 0 ? `${bill.overdueDays}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {outstandings.bills.length === 0 && (
            <p className={styles.empty}>Nothing outstanding as at {asDay(outstandings.asOf)}.</p>
          )}
        </section>
      )}

      {tab === 'forex' && forex && (
        <section className={styles.panel}>
          <div className={styles.buckets}>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Realised</span>
              <span className={styles.bucketAmount}>{forex.totals.realised}</span>
            </div>
            <div className={styles.bucket}>
              <span className={styles.bucketLabel}>Unrealised</span>
              <span className={styles.bucketAmount}>{forex.totals.unrealised}</span>
            </div>
            <div className={cn(styles.bucket, styles.bucketTotal)}>
              <span className={styles.bucketLabel}>Unadjusted</span>
              <span className={styles.bucketAmount}>{forex.totals.unadjusted}</span>
            </div>
          </div>

          <p className={styles.hint}>
            Nothing is posted automatically. Pass a journal moving this from{' '}
            <strong>Unadjusted Forex Gain/Loss</strong> to <strong>Forex Gain</strong> or{' '}
            <strong>Forex Loss</strong> once you accept the figures.
          </p>

          {forex.skippedForMissingRate.length > 0 && (
            <p className={styles.warning}>
              Left out for want of a rate on {asDay(forex.asOf)}:{' '}
              {forex.skippedForMissingRate.join(', ')}
            </p>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Reference</th>
                  <th>Currency</th>
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
                    <td className={styles.num}>{line.fcOutstanding}</td>
                    <td className={styles.num}>{line.bookedBase}</td>
                    <td className={styles.num}>{line.revaluedBase ?? '—'}</td>
                    <td className={cn(styles.num, Number(line.gainLoss) < 0 && styles.overdue)}>
                      {line.gainLoss}
                    </td>
                    <td>{line.kind === 'REALISED' ? 'Realised' : 'Unrealised'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {forex.lines.length === 0 && (
            <p className={styles.empty}>No exchange differences as at {asDay(forex.asOf)}.</p>
          )}
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
                {money(statement.openingBalance)} {statement.openingSide === 'DEBIT' ? 'Dr' : 'Cr'}
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
                      <td className={styles.num}>{money(line.runningBalance)}</td>
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
                {money(statement.closingBalance)} {statement.closingSide === 'DEBIT' ? 'Dr' : 'Cr'}
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
