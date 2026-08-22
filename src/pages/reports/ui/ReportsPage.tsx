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
  getRegister,
  getBankReconciliation,
  getMonthlySummary,
  getAuditTrail,
  getStatementOfAccount,
  getFundsFlow,
  getRatios,
  getExceptions,
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
  BankReconciliationReport,
  MonthlySummaryReport,
  AuditList,
  StatementOfAccountReport,
  FundsFlowReport,
  RatioReport,
  ExceptionReport,
} from '@/entities/report';
import { getPayables, getReceivables } from '@/entities/outstanding';
import type { CashMovementRow } from '@/entities/report';
import { listVoucherTypes } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { listLedgers } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import type { OutstandingsReport } from '@/entities/outstanding';
import { reconcileEntry } from '@/entities/voucher';
import { getForexGainLoss } from '@/entities/currency';
import type { ForexGainLossReport } from '@/entities/currency';
import { Loading, Modal, ColumnChart } from '@/shared/ui';
import { cn, formatMoney, getErrorMessage, localeFor, toCalendarDay } from '@/shared/lib';
import { useButtonBar } from '@/widgets/app-shell';

import { ReportTree } from './ReportTree';
import { LedgerStatement } from './LedgerStatement';
import { SubjectPicker } from './SubjectPicker';
import { BankReconciliationView } from './BankReconciliationView';
import { MonthlySummaryView } from './MonthlySummaryView';
import { AuditTrailView } from './AuditTrailView';
import { StatementOfAccountView } from './StatementOfAccountView';
import { FundsFlowView } from './FundsFlowView';
import { RatioView } from './RatioView';
import { ExceptionView } from './ExceptionView';
import { TrialBalanceView } from './TrialBalanceView';
import { ReceiptsAndPaymentsView } from './ReceiptsAndPaymentsView';
import { MonthlyFigures } from './MonthlyFigures';
import { PeriodControls } from './PeriodControls';
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
  /*
    The five that are about one thing rather than about the whole company. Each names its subject
    in the address — ?report=register&type=SALES, ?report=ledger&ledgerId=… — so a particular
    register or a particular account's statement is as bookmarkable as any other report.
  */
  'register',
  'ledger',
  'bank-reconciliation',
  'monthly-summary',
  'audit',
  'statement-of-account',
  'funds-flow',
  'ratios',
  'exceptions',
] as const;

type Tab = (typeof TAB_IDS)[number];

function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

/** Named once, for the heading of whichever report is open. The menu carries the same names. */
const TAB_LABELS: Record<Tab, string> = {
  register: 'Register',
  ledger: 'Ledger',
  'bank-reconciliation': 'Bank Reconciliation',
  'monthly-summary': 'Monthly Summary',
  audit: 'Audit Trail',
  'statement-of-account': 'Statement of Account',
  'funds-flow': 'Funds Flow',
  ratios: 'Ratios',
  exceptions: 'Exceptions',
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
/**
 * The liabilities side in full: the groups plus the period's profit, which is earned and not yet
 * drawn and so belongs here even though it arrives from the Profit & Loss rather than from a group.
 *
 * Added as numbers because both are already rounded to the penny by the server. The figure that has
 * to tie exactly is `totals.difference`, which the server computes and this never touches.
 */
function sideTotal(liabilities: string, profit: string | undefined): string {
  return (Number(liabilities) + Number(profit ?? 0)).toFixed(2);
}

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
/**
 * The reports fetched on their own rather than with the twelve that load with the screen.
 *
 * Named once so the loading state and the fetch below cannot come to disagree about which they
 * are — a spinner that never clears, or one that never appears, both come from that drifting.
 */
const SUBJECT_TABS = new Set<Tab>([
  'register',
  'ledger',
  'bank-reconciliation',
  'monthly-summary',
  'audit',
  'statement-of-account',
  'funds-flow',
  'ratios',
  'exceptions',
]);

function isComparable(tab: Tab): boolean {
  return (
    tab === 'balance-sheet' ||
    tab === 'profit-loss' ||
    tab === 'trial-balance' ||
    tab === 'receipts-payments' ||
    tab === 'cash-flow'
  );
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('report');

  /**
   * The applied period and the comparison sit in the URL beside the report, for the reason the
   * report itself does: a statement is the thing in this product most likely to be bookmarked,
   * reloaded or sent to somebody, and a comparison that disappears on reload is one the recipient
   * never sees.
   *
   * Read as three values rather than one object so the effect below can depend on the values
   * themselves. An object rebuilt on every render would refetch all twelve reports on every render.
   */
  const appliedFrom = searchParams.get('from') ?? '';
  const appliedTo = searchParams.get('to') ?? '';
  const appliedCompare = searchParams.get('compare') === 'true';

  /**
   * What the report on screen is about, where it is about one thing.
   *
   * Beside the period rather than in component state, for the same reason: a ledger's statement is
   * exactly the sort of thing somebody sends to their accountant, and a link that opens on the
   * wrong account is worse than no link.
   */
  const subjectType = searchParams.get('type') ?? '';
  const subjectLedgerId = searchParams.get('ledgerId') ?? '';
  const subjectGroupId = searchParams.get('groupId') ?? '';

  /** Writes one subject key into the address, dropping the others so two cannot both apply. */
  function chooseSubject(key: 'type' | 'ledgerId' | 'groupId', value: string) {
    const params = new URLSearchParams(searchParams);
    for (const other of ['type', 'ledgerId', 'groupId'] as const) {
      if (other !== key) params.delete(other);
    }
    if (value) params.set(key, value);
    else params.delete(key);

    setSearchParams(params, { replace: true });
  }

  /**
   * Applying replaces rather than pushes: refining a period is an adjustment to the report you are
   * already reading, and pushing would make Back walk through every date you tried instead of
   * returning you to the screen you came from. Only what differs from the default is written, so an
   * unfiltered report keeps a clean address.
   */
  function applyPeriod(next: { from: string; to: string; compare: boolean }) {
    const params = new URLSearchParams(searchParams);
    const setOrDrop = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDrop('from', next.from);
    setOrDrop('to', next.to);
    setOrDrop('compare', next.compare ? 'true' : '');

    setSearchParams(params, { replace: true });
  }

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

  /*
    The five subject reports are fetched on their own, by the effect below, rather than joining the
    twelve that load with the screen: each needs a subject chosen first, and asking the server for
    a ledger statement nobody has picked a ledger for is a request with no answer.
  */
  const [register, setRegister] = useState<DayBookReport | null>(null);
  const [ledgerReport, setLedgerReport] = useState<LedgerStatementReport | null>(null);
  const [reconciliation, setReconciliation] = useState<BankReconciliationReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummaryReport | null>(null);
  const [audit, setAudit] = useState<AuditList | null>(null);
  const [soa, setSoa] = useState<StatementOfAccountReport | null>(null);
  const [fundsFlow, setFundsFlow] = useState<FundsFlowReport | null>(null);
  const [ratios, setRatios] = useState<RatioReport | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionReport | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  /** For the pickers. Small, unchanging within a session, and needed by four of the tabs. */
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);

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
          from: appliedFrom || undefined,
          to: appliedTo || undefined,
          compare: appliedCompare || undefined,
        };
        // `asOf` for the ageing reports is the end of the period being looked at.
        const asOf = appliedTo || undefined;

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
  }, [companyId, appliedFrom, appliedTo, appliedCompare]);

  /* The pickers' contents. Read once per company: neither list changes while a screen is open. */
  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    void Promise.all([listVoucherTypes(id), listLedgers(id)])
      .then(([types, accounts]) => {
        if (cancelled) return;
        setVoucherTypes(types.filter((type) => type.isActive));
        setLedgers(accounts.filter((ledger) => ledger.isActive));
      })
      // A picker that cannot be filled is a degraded screen, not a broken one — the report the
      // reader is already looking at is unaffected, so this must not replace the page.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  /**
   * The report that is about one subject, fetched only when its tab is open and a subject chosen.
   *
   * Kept apart from the load above deliberately. That one asks for twelve reports at once because
   * every one of them is reachable from the tab strip without another request; these five each
   * need a ledger or a voucher type picked first, and folding them in would mean asking for five
   * more reports on every period change whether or not anyone is looking at them.
   */
  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    const params = {
      from: appliedFrom || undefined,
      to: appliedTo || undefined,
    };

    async function loadSubject() {
      setSubjectLoading(true);
      try {
        if (tab === 'register' && subjectType) {
          setRegister(await getRegister(id, { ...params, voucherTypeCodes: [subjectType] }));
        } else if (tab === 'ledger' && subjectLedgerId) {
          setLedgerReport(await getLedgerStatement(id, subjectLedgerId, params));
        } else if (tab === 'bank-reconciliation' && subjectLedgerId) {
          setReconciliation(await getBankReconciliation(id, subjectLedgerId, params));
        } else if (tab === 'monthly-summary' && (subjectLedgerId || subjectGroupId)) {
          setMonthly(
            await getMonthlySummary(
              id,
              subjectLedgerId ? { ledgerId: subjectLedgerId } : { groupId: subjectGroupId },
              params,
            ),
          );
        } else if (tab === 'audit') {
          setAudit(await getAuditTrail(id, { ...params, limit: 200 }));
        } else if (tab === 'statement-of-account' && subjectLedgerId) {
          setSoa(await getStatementOfAccount(id, subjectLedgerId, params));
        } else if (tab === 'funds-flow') {
          setFundsFlow(await getFundsFlow(id, params));
        } else if (tab === 'ratios') {
          setRatios(await getRatios(id, params));
        } else if (tab === 'exceptions') {
          setExceptions(await getExceptions(id, params));
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this report'));
      } finally {
        if (!cancelled) setSubjectLoading(false);
      }
    }

    void loadSubject();

    return () => {
      cancelled = true;
    };
  }, [companyId, tab, subjectType, subjectLedgerId, subjectGroupId, appliedFrom, appliedTo]);

  /* Not memoized: every tree this is handed to is a plain component, so a stable identity saved
     no render, while the compiler could not preserve the wrapper across the await and gave up on
     optimizing the whole page because of it. */
  /**
   * Marks a bank line as shown by the statement, then re-reads the report.
   *
   * Re-read rather than removed from the list here: the two balances at the top move with it, and
   * a screen that dropped the row while leaving the figures alone would be showing a
   * reconciliation that no longer adds up.
   */
  async function markReconciled(voucherId: string, entryId: string, bankDate: string | null) {
    if (!companyId || !subjectLedgerId) return;
    setReconciling(true);
    setError(null);
    try {
      await reconcileEntry(companyId, voucherId, entryId, bankDate);
      setReconciliation(
        await getBankReconciliation(companyId, subjectLedgerId, {
          from: appliedFrom || undefined,
          to: appliedTo || undefined,
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reconcile this line'));
    } finally {
      setReconciling(false);
    }
  }

  async function openLedger(node: ReportNode) {
    if (!companyId) return;
    try {
      setStatement(
        await getLedgerStatement(companyId, node.id, {
          from: appliedFrom || undefined,
          to: appliedTo || undefined,
        }),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open ledger'));
    }
  }

  /**
   * The comparison belonging to the report currently on screen.
   *
   * Each statement carries its own, because each resolves it separately and any of them may come
   * back null — the period was not a whole year, or there is no earlier one. Reading it from the
   * report rather than from the checkbox is what keeps the banner honest.
   */
  const comparison =
    (tab === 'balance-sheet'
      ? balanceSheet?.comparison
      : tab === 'profit-loss'
        ? profitLoss?.comparison
        : tab === 'trial-balance'
          ? trialBalance?.comparison
          : tab === 'receipts-payments'
            ? receiptsPayments?.comparison
            : tab === 'cash-flow'
              ? cashFlow?.comparison
              : null) ?? null;

  function exportCurrentTab() {
    const stamp = balanceSheet ? balanceSheet.period.financialYearLabel : 'report';
    const name = (label: string) => `${label}-${stamp}.csv`;
    const base = ['Name', 'Code', 'Kind', 'Debit', 'Credit', 'Balance', 'Side'];
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
      const priorYear = trialBalance.comparison;
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
          ...(priorYear
            ? [
                `Closing Dr FY ${priorYear.financialYearLabel}`,
                `Closing Cr FY ${priorYear.financialYearLabel}`,
              ]
            : []),
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
            // Empty, not "0.00": the ledger had no such position last year.
            ...(priorYear ? [row.priorClosingDebit ?? '', row.priorClosingCredit ?? ''] : []),
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
            ...(priorYear
              ? [
                  trialBalance.totals.priorClosingDebit ?? '',
                  trialBalance.totals.priorClosingCredit ?? '',
                ]
              : []),
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
      const priorYear = receiptsPayments.comparison;
      const cashRow = (section: string, row: CashMovementRow) => [
        section,
        row.code,
        row.name,
        row.amount,
        ...(priorYear ? [row.priorAmount ?? ''] : []),
      ];
      downloadCsv(
        name('receipts-and-payments'),
        [
          'Section',
          'Code',
          'Ledger',
          'Amount',
          ...(priorYear ? [`Amount FY ${priorYear.financialYearLabel}`] : []),
        ],
        [
          ['Opening', '', '', receiptsPayments.openingBalance, ...(priorYear ? [''] : [])],
          ...receiptsPayments.receipts.map((row) => cashRow('Receipt', row)),
          ...receiptsPayments.payments.map((row) => cashRow('Payment', row)),
          [
            'Total',
            '',
            'Receipts',
            receiptsPayments.totals.receipts,
            ...(priorYear ? [receiptsPayments.totals.priorReceipts ?? ''] : []),
          ],
          [
            'Total',
            '',
            'Payments',
            receiptsPayments.totals.payments,
            ...(priorYear ? [receiptsPayments.totals.priorPayments ?? ''] : []),
          ],
          ['Closing', '', '', receiptsPayments.closingBalance, ...(priorYear ? [''] : [])],
        ],
      );
    } else if (tab === 'cash-flow' && cashFlow) {
      const priorYear = cashFlow.comparison;
      const withYear = (value: string | undefined) => (priorYear ? [value ?? ''] : []);
      downloadCsv(name('cash-flow'), withPrior(priorYear), [
        [
          'INFLOW',
          '',
          '',
          '',
          '',
          cashFlow.totals.inflow,
          'DEBIT',
          ...withYear(cashFlow.totals.priorInflow),
        ],
        ...flattenNodes(cashFlow.inflow, 0, Boolean(priorYear)),
        [
          'OUTFLOW',
          '',
          '',
          '',
          '',
          cashFlow.totals.outflow,
          'CREDIT',
          ...withYear(cashFlow.totals.priorOutflow),
        ],
        ...flattenNodes(cashFlow.outflow, 0, Boolean(priorYear)),
        [
          'Net change',
          '',
          '',
          '',
          '',
          cashFlow.totals.netChange,
          '',
          ...withYear(cashFlow.totals.priorNetChange),
        ],
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
        applyPeriod({ from: '', to: '', compare: appliedCompare });
      },
      disabled: !appliedFrom && !appliedTo,
    },
  ]);

  if (!companyId) return null;
  if (loadError) return <p className={styles.error}>{loadError}</p>;

  const period = balanceSheet?.period;

  const outstandings = tab === 'receivables' ? receivables : payables;

  /*
    Kept out of the branches below so the screen keeps its heading and its period controls
    while the next period is being fetched. Replacing the whole page with a spinner took away
    the very controls a reader had just used, and left the report with no <h1> at all until
    twelve requests had come back.
  */
  const header = (
    <div className={styles.header}>
      <div>
        {/* The report itself, not the word "Reports" — the shell's context strip already says
            which company and year these figures belong to, and this is the line that gets
            printed at the top of the page. */}
        <h1 className={styles.title}>{TAB_LABELS[tab]}</h1>
        {!loading && period && (
          <p className={styles.subtitle}>
            FY {period.financialYearLabel} · {toCalendarDay(period.from)} to{' '}
            {toCalendarDay(period.to)}
          </p>
        )}
      </div>

      {/*
        Keyed on the applied period, so anything that changes it without leaving this screen —
        Back, Forward, a link carrying no period — reseeds the boxes. Boxes that go on showing
        dates the statement below is not using are worse than no boxes at all.
      */}
      {/*
        Which subject the report is about, for the reports that are about one. Sits before the
        period because it is the first choice a reader makes: a ledger statement with no ledger
        is not a statement waiting for a date, it is nothing at all.
      */}
      {tab === 'register' && (
        <SubjectPicker
          id="report-type"
          label="Voucher type"
          placeholder="Choose a voucher type…"
          value={subjectType}
          onChange={(value) => chooseSubject('type', value)}
          options={voucherTypes.map((type) => ({ value: type.code, label: type.name }))}
        />
      )}
      {(tab === 'ledger' || tab === 'monthly-summary') && (
        <SubjectPicker
          id="report-ledger"
          label="Ledger"
          placeholder="Choose an account…"
          value={subjectLedgerId}
          onChange={(value) => chooseSubject('ledgerId', value)}
          options={ledgers.map((ledger) => ({ value: ledger.id, label: ledger.name }))}
        />
      )}
      {tab === 'bank-reconciliation' && (
        <SubjectPicker
          id="report-bank"
          label="Account"
          placeholder="Choose a cash or bank account…"
          value={subjectLedgerId}
          onChange={(value) => chooseSubject('ledgerId', value)}
          /* Only the accounts that have a statement to be reconciled against. */
          options={ledgers
            .filter((ledger) => ledger.ledgerType === 'CASH' || ledger.ledgerType === 'BANK')
            .map((ledger) => ({ value: ledger.id, label: ledger.name }))}
        />
      )}

      <PeriodControls
        key={`${appliedFrom}|${appliedTo}|${appliedCompare}`}
        applied={{ from: appliedFrom, to: appliedTo, compare: appliedCompare }}
        canCompare={isComparable(tab)}
        onApply={applyPeriod}
      />
    </div>
  );

  if (loading)
    return (
      <div className={styles.page} ref={pageRef}>
        {header}
        <Loading label="Loading reports…" />
      </div>
    );

  return (
    <div className={styles.page} ref={pageRef}>
      {header}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {appliedCompare && isComparable(tab) && (
        <p className={styles.hint} role="status">
          {comparison
            ? `Compared with FY ${comparison.financialYearLabel}.`
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
            {/*
              The heading totals the whole side, the period profit included.

              Profit belongs to this side — it is what the owner has earned and not yet drawn — but
              it sits in its own row below because it comes from the Profit & Loss rather than from
              a group. Totalling only the groups printed "Liabilities ₹0.00" beside "Assets
              ₹4,53,600.00" on books that balance perfectly, which reads as an error and is not one.
            */}
            <h2 className={styles.panelTitle}>
              Liabilities{' '}
              {balanceSheet.totals.priorLiabilities !== undefined && (
                <span className={styles.panelPrior}>
                  {money(
                    sideTotal(
                      balanceSheet.totals.priorLiabilities,
                      balanceSheet.totals.priorCurrentPeriodProfit,
                    ),
                  )}
                </span>
              )}
              <span className={styles.panelTotal}>
                {money(
                  sideTotal(
                    balanceSheet.totals.liabilities,
                    balanceSheet.totals.currentPeriodProfit,
                  ),
                )}
              </span>
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
          <MonthlyFigures
            labels={profitLoss.monthly.map((month) => monthLabel(month.month))}
            format={money}
            series={[
              {
                label: 'Income',
                values: profitLoss.monthly.map((month) => Number(month.income)),
              },
              {
                label: 'Expenses',
                values: profitLoss.monthly.map((month) => Number(month.expenses)),
              },
              {
                label: profitLoss.comparison
                  ? `Net · FY ${profitLoss.period.financialYearLabel}`
                  : 'Net',
                values: profitLoss.monthly.map((month) => Number(month.netProfit)),
              },
              /*
                A month the prior year had nothing in is null here, not zero: the chart draws it as
                no bar, and the table has to say the same thing rather than claim a nil result.
              */
              ...(profitLoss.comparison
                ? [
                    {
                      label: `Net · FY ${profitLoss.comparison.financialYearLabel}`,
                      values: profitLoss.monthly.map((month) =>
                        month.priorNetProfit === undefined ? null : Number(month.priorNetProfit),
                      ),
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

      {/*
        Each waits for its subject rather than showing an empty frame: a table of nothing looks
        like an account with no movement, which is a different and much more alarming statement.
      */}
      {tab === 'register' && !subjectType && (
        <p className={styles.empty}>Choose a voucher type to see its register.</p>
      )}
      {tab === 'register' && subjectType && register && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            {voucherTypes.find((type) => type.code === subjectType)?.name ?? subjectType}
            <span className={styles.panelTotal}>{money(register.total)}</span>
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table} data-stack>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Narration</th>
                  <th>Status</th>
                  <th className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {register.rows.map((row) => (
                  <tr key={row.voucherId}>
                    <td>{toCalendarDay(row.voucherDate)}</td>
                    <td>{row.voucherNumber}</td>
                    <td>{row.narration ?? '—'}</td>
                    <td>{row.status}</td>
                    <td className={styles.num}>{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {register.rows.length === 0 && (
            <p className={styles.empty}>Nothing of this type in the period.</p>
          )}
        </section>
      )}

      {tab === 'ledger' && !subjectLedgerId && (
        <p className={styles.empty}>Choose an account to see its statement.</p>
      )}
      {tab === 'ledger' && subjectLedgerId && ledgerReport && (
        <LedgerStatement statement={ledgerReport} money={money} />
      )}

      {tab === 'bank-reconciliation' && !subjectLedgerId && (
        <p className={styles.empty}>Choose a cash or bank account to reconcile.</p>
      )}
      {tab === 'bank-reconciliation' && subjectLedgerId && reconciliation && (
        <BankReconciliationView
          report={reconciliation}
          money={money}
          saving={reconciling}
          onReconcile={markReconciled}
        />
      )}

      {tab === 'monthly-summary' && !subjectLedgerId && !subjectGroupId && (
        <p className={styles.empty}>Choose an account to see it month by month.</p>
      )}
      {tab === 'monthly-summary' && (subjectLedgerId || subjectGroupId) && monthly && (
        <MonthlySummaryView report={monthly} money={money} monthLabel={monthLabel} />
      )}

      {tab === 'audit' && audit && <AuditTrailView trail={audit} />}

      {tab === 'statement-of-account' && !subjectLedgerId && (
        <p className={styles.empty}>Choose a party to see their statement.</p>
      )}
      {tab === 'statement-of-account' && subjectLedgerId && soa && (
        <StatementOfAccountView report={soa} money={money} />
      )}

      {tab === 'funds-flow' && fundsFlow && <FundsFlowView report={fundsFlow} money={money} />}
      {tab === 'ratios' && ratios && <RatioView report={ratios} money={money} />}
      {tab === 'exceptions' && exceptions && <ExceptionView report={exceptions} />}

      {subjectLoading && SUBJECT_TABS.has(tab) && <Loading label="Loading…" />}

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
            caption={
              cashFlow.comparison
                ? `Cash in, cash out and the net change each month, against the net change of FY ${cashFlow.comparison.financialYearLabel}`
                : 'Cash in, cash out and the net change for each month of the period'
            }
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
                /* Named for its year only while there are two of them on the plot. */
                label: cashFlow.comparison
                  ? `Net · FY ${cashFlow.period.financialYearLabel}`
                  : 'Net',
                color: 'var(--data-3)',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
              /* Only net is carried over, for the reason given above the profit and loss chart. */
              ...(cashFlow.comparison
                ? [
                    {
                      label: `Net · FY ${cashFlow.comparison.financialYearLabel}`,
                      color: 'var(--data-4)',
                      values: cashFlow.monthly.map((month) => Number(month.priorNetChange ?? 0)),
                    },
                  ]
                : []),
            ]}
          />
          <MonthlyFigures
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            format={money}
            series={[
              {
                label: 'Cash in',
                values: cashFlow.monthly.map((month) => Number(month.inflow)),
              },
              {
                label: 'Cash out',
                values: cashFlow.monthly.map((month) => Number(month.outflow)),
              },
              {
                label: cashFlow.comparison
                  ? `Net · FY ${cashFlow.period.financialYearLabel}`
                  : 'Net',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
              ...(cashFlow.comparison
                ? [
                    {
                      label: `Net · FY ${cashFlow.comparison.financialYearLabel}`,
                      values: cashFlow.monthly.map((month) =>
                        month.priorNetChange === undefined ? null : Number(month.priorNetChange),
                      ),
                    },
                  ]
                : []),
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
                showPrior={Boolean(cashFlow.comparison)}
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
                showPrior={Boolean(cashFlow.comparison)}
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
