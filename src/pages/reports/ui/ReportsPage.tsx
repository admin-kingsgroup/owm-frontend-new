import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';

import { useStackedTables } from '@/shared/hooks';
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
  getCashBook,
  getBankBook,
  getGroupSummary,
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
import { cn, formatMoney, getErrorMessage, localeFor, toCalendarDay } from '@/shared/lib';
import { useButtonBar } from '@/widgets/app-shell';

import { ReportTree } from './ReportTree';
import { LedgerStatement } from './LedgerStatement';
import { TrialBalanceView } from './TrialBalanceView';
import { ReceiptsAndPaymentsView } from './ReceiptsAndPaymentsView';
import { OutstandingsView } from './OutstandingsView';
import { downloadCsv, flattenNodes } from './export-csv';
import styles from './ReportsPage.module.css';

/**
 * Every report this screen can show.
 *
 * One list rather than a union plus a separate array: the menu bar links straight at a report by
 * id, so an id that exists in one place and not the other is a link that lands on the wrong
 * statement.
 */
const TAB_IDS = [
  'balance-sheet',
  'profit-loss',
  'trial-balance',
  'day-book',
  'cash-book',
  'bank-book',
  'group-summary',
  'receipts-payments',
  'cash-flow',
  'receivables',
  'payables',
  'forex',
] as const;

type Tab = (typeof TAB_IDS)[number];

function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

/** Named once, for the heading of whichever report is open. The menu carries the same names. */
const TAB_LABELS: Record<Tab, string> = {
  'balance-sheet': 'Balance Sheet',
  'profit-loss': 'Profit & Loss',
  'trial-balance': 'Trial Balance',
  'day-book': 'Day Book',
  'cash-book': 'Cash Book',
  'bank-book': 'Bank Book',
  'group-summary': 'Group Summary',
  'receipts-payments': 'Receipts & Payments',
  'cash-flow': 'Cash Flow',
  receivables: 'Receivables',
  payables: 'Payables',
  forex: 'Forex Gain/Loss',
};

/**
 * Whether this company can produce a report at all.
 *
 * Three of them exist only behind a company feature, and now that the open report comes from the
 * URL the answer matters for more than which tabs to draw: a bookmark kept after bill-wise was
 * switched off, or an address typed by hand, would otherwise open an outstandings report the
 * company no longer keeps. A company still loading is given the benefit of the doubt — bouncing off
 * a report that turns out to be perfectly valid is worse than a moment's wait.
 */
function isAvailable(tab: Tab, company: Company | null): boolean {
  if (!company) return true;
  if (tab === 'receivables' || tab === 'payables') return company.features.billWiseDetails;
  if (tab === 'forex') return company.features.multiCurrency;
  return true;
}

/**
 * The two statements the server answers a comparison for. The flag rides along on every report
 * request, but the rest ignore it, so offering the control on those reports would be offering a
 * tick box that does nothing — worse than not offering it, because the reader is left to wonder
 * whether the two years really did match.
 */
function isComparable(tab: Tab): boolean {
  return tab === 'balance-sheet' || tab === 'profit-loss';
}

export function ReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();

  /*
    Every statement below is a row-per-record table, which is what reads well as a list of cards on
    a phone. The labels come from each table's own header row rather than being repeated down the
    body — see useStackedTables. Declared up here with the other hooks: this component returns
    early in several places, and a hook after one of those does not run in the same order twice.
  */
  const pageRef = useRef<HTMLDivElement>(null);
  useStackedTables(pageRef);
  /**
   * Which report is open lives in the URL, not in component state.
   *
   * The menu bar links straight at a report, and a statement is the thing in this product most
   * likely to be bookmarked, reloaded or sent to someone — all of which used to land on the Balance
   * Sheet whatever had been open. An unknown or missing id falls back rather than blanking the page.
   */
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('report');

  // Empty means "the whole financial year", which is what the server defaults to.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [compare, setCompare] = useState(false);
  const [applied, setApplied] = useState({ from: '', to: '', compare: false });

  const [company, setCompany] = useState<Company | null>(null);

  /* Derived here rather than beside the raw search param, because whether a report is available
     at all depends on the company's features — see isAvailable. */
  const tab: Tab =
    isTab(requested) && isAvailable(requested, company) ? requested : 'balance-sheet';

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitAndLossReport | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [dayBook, setDayBook] = useState<DayBookReport | null>(null);
  const [receiptsPayments, setReceiptsPayments] = useState<ReceiptsAndPaymentsReport | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [receivables, setReceivables] = useState<OutstandingsReport | null>(null);
  const [payables, setPayables] = useState<OutstandingsReport | null>(null);
  const [forex, setForex] = useState<ForexGainLossReport | null>(null);
  const [cashBook, setCashBook] = useState<LedgerStatementReport[] | null>(null);
  const [bankBook, setBankBook] = useState<LedgerStatementReport[] | null>(null);
  const [groupSummary, setGroupSummary] = useState<ReportNode[] | null>(null);

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

        const [companyResult, bs, pl, tb, db, rp, cf, rec, pay, cash, bank, groups] =
          await Promise.all([
            getCompany(id),
            getBalanceSheet(id, params),
            getProfitAndLoss(id, params),
            getTrialBalance(id, params),
            getDayBook(id, params),
            getReceiptsAndPayments(id, params),
            getCashFlow(id, params),
            getReceivables(id, asOf),
            getPayables(id, asOf),
            getCashBook(id, params),
            getBankBook(id, params),
            getGroupSummary(id, params),
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
        setCashBook(cash);
        setBankBook(bank);
        setGroupSummary(groups);

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

  /* Not memoized: every tree this is handed to is a plain component, so a stable identity saved
     no render, while the compiler could not preserve the wrapper across the await and gave up on
     optimizing the whole page because of it. */
  async function openLedger(node: ReportNode) {
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
  }

  function exportCurrentTab() {
    const stamp = balanceSheet ? balanceSheet.period.financialYearLabel : 'report';
    const name = (label: string) => `${label}-${stamp}.csv`;
    const base = ['Name', 'Code', 'Kind', 'Debit', 'Credit', 'Balance', 'Side'];
    /* The reports that do not compare keep the plain header set. */
    const treeHeaders = base;
    /*
      The comparison column is added only when there is one, so a file exported without comparing
      keeps the shape anything downstream was built against. Named for the year it holds rather
      than "Prior", because a saved file outlives the screen that produced it.
    */
    const withPrior = (comparison: { financialYearLabel: string } | null) =>
      comparison ? [...base, `Balance FY ${comparison.financialYearLabel}`] : base;

    if (tab === 'balance-sheet' && balanceSheet) {
      const cmp = balanceSheet.comparison;
      downloadCsv(name('balance-sheet'), withPrior(cmp), [
        [
          'ASSETS',
          '',
          '',
          '',
          '',
          balanceSheet.totals.assets,
          'DEBIT',
          ...(cmp ? [balanceSheet.totals.priorAssets ?? ''] : []),
        ],
        ...flattenNodes(balanceSheet.assets, 0, Boolean(cmp)),
        [
          'LIABILITIES',
          '',
          '',
          '',
          '',
          balanceSheet.totals.liabilities,
          'CREDIT',
          ...(cmp ? [balanceSheet.totals.priorLiabilities ?? ''] : []),
        ],
        ...flattenNodes(balanceSheet.liabilities, 0, Boolean(cmp)),
        [
          'Profit for the period',
          '',
          '',
          '',
          '',
          balanceSheet.totals.currentPeriodProfit,
          '',
          ...(cmp ? [balanceSheet.totals.priorCurrentPeriodProfit ?? ''] : []),
        ],
      ]);
    } else if (tab === 'profit-loss' && profitLoss) {
      const cmp = profitLoss.comparison;
      downloadCsv(name('profit-and-loss'), withPrior(cmp), [
        [
          'INCOME',
          '',
          '',
          '',
          '',
          profitLoss.totals.income,
          'CREDIT',
          ...(cmp ? [profitLoss.totals.priorIncome ?? ''] : []),
        ],
        ...flattenNodes(profitLoss.income, 0, Boolean(cmp)),
        [
          'EXPENSES',
          '',
          '',
          '',
          '',
          profitLoss.totals.expenses,
          'DEBIT',
          ...(cmp ? [profitLoss.totals.priorExpenses ?? ''] : []),
        ],
        ...flattenNodes(profitLoss.expenses, 0, Boolean(cmp)),
        [
          'Net profit',
          '',
          '',
          '',
          '',
          profitLoss.totals.netProfit,
          '',
          ...(cmp ? [profitLoss.totals.priorNetProfit ?? ''] : []),
        ],
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
          toCalendarDay(row.voucherDate),
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
          toCalendarDay(bill.billDate),
          bill.dueDate ? toCalendarDay(bill.dueDate) : '',
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

  /*
    What this screen can do, printed down the right-hand side with the key that does it. Declared
    before the early returns below, because a hook cannot be called conditionally — the bar simply
    shows the same actions while the reports are still arriving, and they are inert until they do.
  */
  useButtonBar([
    {
      group: 'This report',
      key: 'Ctrl+E',
      label: 'Export CSV',
      onSelect: exportCurrentTab,
      disabled: loading,
    },
    {
      group: 'This report',
      key: 'Ctrl+P',
      label: 'Print',
      onSelect: () => window.print(),
      disabled: loading,
    },
    {
      group: 'This report',
      key: 'Alt+Y',
      label: 'Whole year',
      onSelect: () => {
        setFrom('');
        setTo('');
        setApplied({ from: '', to: '', compare });
      },
      disabled: !applied.from && !applied.to,
    },
  ]);

  if (!companyId) return null;
  if (loading) return <Loading label="Loading reports…" />;
  if (loadError) return <p className={styles.error}>{loadError}</p>;

  const period = balanceSheet?.period;

  const outstandings = tab === 'receivables' ? receivables : payables;

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.header}>
        <div>
          {/* The report itself, not the word "Reports" — the shell's context strip already says
              which company and year these figures belong to, and this is the line that gets
              printed at the top of the page. */}
          <h1 className={styles.title}>{TAB_LABELS[tab]}</h1>
          {period && (
            <p className={styles.subtitle}>
              FY {period.financialYearLabel} · {toCalendarDay(period.from)} to{' '}
              {toCalendarDay(period.to)}
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
          {isComparable(tab) && (
            <div className={styles.compareField}>
              <Checkbox
                id="report-compare"
                label="Compare with last year"
                checked={compare}
                onChange={(event) => setCompare(event.target.checked)}
              />
            </div>
          )}
          <Button variant="secondary" onClick={() => setApplied({ from, to, compare })}>
            Apply
          </Button>
          {/*
            Whole year, CSV and Print are not repeated here: they are on the shell's button bar,
            which is on screen at every width and carries the key for each of them. Two buttons for
            one action is how a toolbar starts disagreeing with itself.
          */}
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {applied.compare && isComparable(tab) && (
        <p className={styles.hint} role="status">
          {(tab === 'balance-sheet' ? balanceSheet?.comparison : profitLoss?.comparison)
            ? `Compared with FY ${(tab === 'balance-sheet' ? balanceSheet : profitLoss)?.comparison?.financialYearLabel}.`
            : 'No comparison available — this is the first financial year, or the period is not a whole one.'}
        </p>
      )}

      {/*
        No tab strip. Nine of them across the top was the thing that made this screen unreadable,
        and the menu bar now lists every report under a heading, with Alt+B, Alt+P and Alt+D for the
        three reached most often. The heading above says which one is open.
      */}

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
            scaleLabel={money}
            caption={
              profitLoss.comparison
                ? `Income, expenses and net profit each month, against the net profit of FY ${profitLoss.comparison.financialYearLabel}`
                : 'Income, expenses and net profit for each month of the period'
            }
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
              {
                /* Named for its year only while there are two of them on the plot. */
                label: profitLoss.comparison
                  ? `Net · FY ${profitLoss.period.financialYearLabel}`
                  : 'Net',
                color: 'var(--data-3)',
                values: profitLoss.monthly.map((month) => Number(month.netProfit)),
              },
              /*
                Only net is carried over from last year: its income and expenses as well would put
                six bars in every month and the shape would be lost. Net is the figure that answers
                "was this month better than the same month last year", and it is drawn beside this
                year's net so the pair can actually be read against each other.
              */
              ...(profitLoss.comparison
                ? [
                    {
                      label: `Net · FY ${profitLoss.comparison.financialYearLabel}`,
                      color: 'var(--data-4)',
                      values: profitLoss.monthly.map((month) => Number(month.priorNetProfit ?? 0)),
                    },
                  ]
                : []),
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
        <TrialBalanceView trialBalance={trialBalance} money={money} openLedger={openLedger} />
      )}

      {/*
        The Cash and Bank books are every cash or bank account's statement one after another, drawn
        by the same component the drill-down uses — see LedgerStatement.
      */}
      {(tab === 'cash-book' || tab === 'bank-book') && (
        <section className={styles.panel}>
          {(tab === 'cash-book' ? cashBook : bankBook)?.length === 0 ? (
            <p className={styles.empty}>
              This company has no {tab === 'cash-book' ? 'cash' : 'bank'} account yet.
            </p>
          ) : (
            (tab === 'cash-book' ? cashBook : bankBook)?.map((entry) => (
              <LedgerStatement key={entry.ledger.id} statement={entry} money={money} heading />
            ))
          )}
        </section>
      )}

      {tab === 'group-summary' && groupSummary && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Every group, with its closing position</span>
          </div>
          {groupSummary.length === 0 ? (
            <p className={styles.empty}>This company has no account groups yet.</p>
          ) : (
            <ReportTree nodes={groupSummary} onSelectLedger={openLedger} formatAmount={money} />
          )}
        </section>
      )}

      {tab === 'day-book' && dayBook && (
        <section className={styles.panel}>
          <div className={styles.tableWrap}>
            <table className={styles.table} data-stack>
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
                    <td>{toCalendarDay(row.voucherDate)}</td>
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
        <ReceiptsAndPaymentsView report={receiptsPayments} money={money} />
      )}

      {tab === 'cash-flow' && cashFlow && cashFlow.monthly.length > 0 && (
        <section className={styles.chartPanel}>
          <h2 className={styles.chartTitle}>Month by month</h2>
          <ColumnChart
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            formatValue={money}
            scaleLabel={money}
            caption="Cash in, cash out and the net change for each month of the period"
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
        <OutstandingsView outstandings={outstandings} money={money} />
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
              Left out for want of a rate on {toCalendarDay(forex.asOf)}:{' '}
              {forex.skippedForMissingRate.join(', ')}
            </p>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table} data-stack>
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
            <p className={styles.empty}>
              No exchange differences as at {toCalendarDay(forex.asOf)}.
            </p>
          )}
        </section>
      )}

      <Modal
        open={statement !== null}
        onClose={() => setStatement(null)}
        title={statement ? `${statement.ledger.name} (${statement.ledger.code})` : ''}
      >
        {statement && (
          <>
            <LedgerStatement statement={statement} money={money} />
            <button type="button" className={styles.closeLink} onClick={() => setStatement(null)}>
              <X size={14} /> Close
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
