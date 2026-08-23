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
  type GroupSummaryReport,
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
import { listVoucherTypes } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { listLedgers } from '@/entities/ledger';
import { listAccountGroups, partyGroupTest } from '@/entities/account-group';
import type { AccountGroup } from '@/entities/account-group';
import type { Ledger } from '@/entities/ledger';
import type { OutstandingsReport } from '@/entities/outstanding';
import { reconcileEntry } from '@/entities/voucher';
import { getForexGainLoss } from '@/entities/currency';
import type { ForexGainLossReport } from '@/entities/currency';
import { Loading, Modal } from '@/shared/ui';
import { formatCalendarDay, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';
import { useButtonBar } from '@/widgets/app-shell';

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
import { PeriodControls } from './PeriodControls';
import { BalanceSheetView } from './BalanceSheetView';
import { CashBankBookView } from './CashBankBookView';
import { GroupSummaryView } from './GroupSummaryView';
import { RegisterView } from './RegisterView';
import { DayBookView } from './DayBookView';
import { ForexView } from './ForexView';
import { ProfitLossView } from './ProfitLossView';
import { CashFlowView } from './CashFlowView';
import { exportReport, periodOf, type LoadedReports } from './export-report';
import { TAB_LABELS, isTab, isAvailable, usesPeriod, isComparable, type Tab } from './tabs';
import { OutstandingsView } from './OutstandingsView';
import styles from './ReportsPage.module.css';

/**
 * Every report this screen can show.
 *
 * One list rather than a union plus a separate array: the menu bar links straight at a report by
 * id, so an id that exists in one place and not the other is a link that lands on the wrong
 * statement.
 */

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
  /* Depended on by name rather than through `company`, whose identity changes on every read. */
  const multiCurrency = company?.features.multiCurrency ?? false;
  /*
    False until the company is known, which is what keeps the fetch below from firing at a report
    the company may not keep. `isAvailable` deliberately gives a loading company the benefit of the
    doubt so the screen does not bounce off a valid report — right for what is rendered, but it
    means the open tab can briefly be one the company has no data for, and the server refuses those
    outright rather than answering with bills left over from before the feature was switched off.
  */
  const billWise = company?.features.billWiseDetails ?? false;

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
  const [groupSummary, setGroupSummary] = useState<GroupSummaryReport | null>(null);

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
  const [reconciling, setReconciling] = useState(false);

  /** For the pickers. Small, unchanging within a session, and needed by four of the tabs. */
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);

  const [statement, setStatement] = useState<LedgerStatementReport | null>(null);
  const [loading, setLoading] = useState(true);
  /** Only a failed initial load replaces the page; anything later is shown without losing it. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The company itself. Read once per company rather than with every report: nothing about it
   * changes when the period does, and `money` and the tab list both need it before anything else
   * can be drawn.
   */
  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    getCompany(id)
      .then((result) => {
        if (!cancelled) setCompany(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Could not load this company'));
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  /**
   * The open report, and only the open report.
   *
   * This used to ask for twelve at once, on the theory that switching tabs should then be instant.
   * It made every change of date twelve requests to draw one statement, and on books of any size
   * the eleven nobody was looking at were the slow ones. A tab now costs the report it opens,
   * which is the request that had to happen anyway.
   *
   * Each branch writes its own state and leaves the rest alone, so a report already read stays on
   * screen when you come back to it — the second visit is instant without the first having asked
   * for eleven reports nobody wanted.
   */
  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    const params = {
      from: appliedFrom || undefined,
      to: appliedTo || undefined,
      compare: appliedCompare || undefined,
    };
    // `asOf` for the ageing reports is the end of the period being looked at.
    const asOf = appliedTo || undefined;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        switch (tab) {
          case 'balance-sheet':
            setBalanceSheet(await getBalanceSheet(id, params));
            break;
          case 'profit-loss':
            setProfitLoss(await getProfitAndLoss(id, params));
            break;
          case 'trial-balance':
            setTrialBalance(await getTrialBalance(id, params));
            break;
          case 'day-book':
            setDayBook(await getDayBook(id, params));
            break;
          case 'receipts-payments':
            setReceiptsPayments(await getReceiptsAndPayments(id, params));
            break;
          case 'cash-flow':
            setCashFlow(await getCashFlow(id, params));
            break;
          case 'cash-book':
            setCashBook(await getCashBook(id, params));
            break;
          case 'bank-book':
            setBankBook(await getBankBook(id, params));
            break;
          case 'group-summary':
            setGroupSummary(await getGroupSummary(id, params));
            break;
          case 'receivables':
            // Only meaningful once the company keeps its books bill by bill.
            setReceivables(billWise ? await getReceivables(id, asOf) : null);
            break;
          case 'payables':
            setPayables(billWise ? await getPayables(id, asOf) : null);
            break;
          case 'register':
            if (subjectType) {
              setRegister(await getRegister(id, { ...params, voucherTypeCodes: [subjectType] }));
            }
            break;
          case 'ledger':
            if (subjectLedgerId) {
              setLedgerReport(await getLedgerStatement(id, subjectLedgerId, params));
            }
            break;
          case 'bank-reconciliation':
            if (subjectLedgerId) {
              setReconciliation(await getBankReconciliation(id, subjectLedgerId, params));
            }
            break;
          case 'monthly-summary':
            if (subjectLedgerId || subjectGroupId) {
              setMonthly(
                await getMonthlySummary(
                  id,
                  subjectLedgerId ? { ledgerId: subjectLedgerId } : { groupId: subjectGroupId },
                  params,
                ),
              );
            }
            break;
          case 'statement-of-account':
            if (subjectLedgerId) {
              setSoa(await getStatementOfAccount(id, subjectLedgerId, params));
            }
            break;
          case 'funds-flow':
            setFundsFlow(await getFundsFlow(id, params));
            break;
          case 'ratios':
            setRatios(await getRatios(id, params));
            break;
          case 'exceptions':
            setExceptions(await getExceptions(id, params));
            break;
          case 'audit':
            /*
              No period. The trail is ordered by when a change was made, not by the dates of the
              vouchers changed — asking it for a financial year returns nothing at all, because the
              changes to that year's vouchers were made today.
            */
            setAudit(await getAuditTrail(id, { limit: 200 }));
            break;
          case 'forex':
            // Only meaningful once the company transacts in more than one currency.
            setForex(multiCurrency ? await getForexGainLoss(id, asOf) : null);
            break;
        }
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Could not load this report'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    tab,
    appliedFrom,
    appliedTo,
    appliedCompare,
    subjectType,
    subjectLedgerId,
    subjectGroupId,
    multiCurrency,
    billWise,
  ]);

  /* The pickers' contents. Read once per company: neither list changes while a screen is open. */
  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    void Promise.all([listVoucherTypes(id), listLedgers(id), listAccountGroups(id)])
      .then(([types, accounts, accountGroups]) => {
        if (cancelled) return;
        setVoucherTypes(types.filter((type) => type.isActive));
        setLedgers(accounts.filter((ledger) => ledger.isActive));
        setGroups(accountGroups.filter((group) => group.isActive));
      })
      // A picker that cannot be filled is a degraded screen, not a broken one — the report the
      // reader is already looking at is unaffected, so this must not replace the page.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [companyId]);

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
  /* Which ledgers are somebody the company deals with — see partyGroupTest. */
  const isParty = partyGroupTest(groups);
  const parties = ledgers.filter((ledger) => isParty(ledger.accountGroupId));

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

  /**
   * Everything the screen has read so far, in one bag.
   *
   * Built once because two things need it and they must agree: the period printed above the
   * statement and the period stamped into the exported file's name. Two hand-written lists of the
   * same twenty-one reports would drift the first time one was added to only one of them.
   */
  const loaded: LoadedReports = {
    balanceSheet,
    profitLoss,
    trialBalance,
    dayBook,
    receiptsPayments,
    cashFlow,
    receivables,
    payables,
    forex,
    cashBook,
    bankBook,
    groupSummary,
    register,
    ledgerReport,
    reconciliation,
    monthly,
    audit,
    soa,
    fundsFlow,
    ratios,
    exceptions,
  };

  /**
   * The period the statement on screen was actually built from.
   *
   * Taken from the open report rather than from the balance sheet, which is no longer read unless
   * somebody is looking at it — and from the *open* one rather than from whichever happens to be
   * loaded, because a report left in state from an earlier range would otherwise print its period
   * over a statement covering a different one. The dates above a set of figures either belong to
   * those figures or they are worse than absent.
   */
  const period = periodOf(tab, loaded);

  function exportCurrentTab() {
    exportReport(tab, loaded, { subjectType, periodLabel: period?.financialYearLabel ?? '' });
  }

  /**
   * A date, written the way the company's country writes it.
   *
   * Every grid used to print the raw "2026-05-12" while the strip above it said "1/4/2026" and the
   * status bar said "23/8/2026" — three formats for the same kind of thing on one screen, and the
   * only one a reader could misread as a different day.
   */
  const day = useCallback(
    (value: string) => formatCalendarDay(value, company?.country),
    [company?.country],
  );

  /**
   * What a voucher type is called, given its code. Falls back to the code, which is the honest
   * answer for a type that has since been deleted — better than a blank cell.
   */
  const typeName = useCallback(
    (code: string) => voucherTypes.find((type) => type.code === code)?.name ?? code,
    [voucherTypes],
  );

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
  /**
   * How a figure is written on a report.
   *
   * No currency symbol: the status strip says which currency the figures are in, and repeating it
   * on every one of fifty cells only widens the columns. Nil is written as nothing, and the grid
   * draws a dot in the empty cell — a statement where five of seven columns are entirely zero is
   * one where the two figures that matter are hidden among forty that do not.
   */
  const money = useCallback(
    // string from the API, number from the chart — formatMoney takes either.
    (value: string | number) => formatMoney(value, { country: company?.country, blankZero: true }),
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
      // Off rather than silent on the few reports with no writer: a button that does nothing when
      // pressed is worse than one that shows it will not.
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
        {!loading && !loadError && period && (
          <p className={styles.subtitle}>
            FY {period.financialYearLabel} · {day(period.from)} to {day(period.to)}
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
      {tab === 'statement-of-account' && (
        <SubjectPicker
          id="report-party"
          label="Party"
          placeholder="Choose a customer or supplier…"
          value={subjectLedgerId}
          onChange={(value) => chooseSubject('ledgerId', value)}
          /*
            Only the accounts that are somebody. A statement of account for Cash or for Sales is
            not a thing anyone sends, and offering every ledger buries the few that are parties.
          */
          options={parties.map((ledger) => ({ value: ledger.id, label: ledger.name }))}
        />
      )}
      {tab === 'monthly-summary' && (
        <SubjectPicker
          id="report-subject"
          label="Ledger or group"
          placeholder="Choose an account or a group…"
          value={
            subjectGroupId
              ? `group:${subjectGroupId}`
              : subjectLedgerId
                ? `ledger:${subjectLedgerId}`
                : ''
          }
          /* The value carries which kind it is, because the two go into different URL keys. */
          onChange={(value) => {
            const [kind, id] = value.split(':');
            if (!id) chooseSubject('ledgerId', '');
            else chooseSubject(kind === 'group' ? 'groupId' : 'ledgerId', id);
          }}
          options={[
            ...groups.map((group) => ({
              value: `group:${group.id}`,
              label: group.name,
              group: 'Groups',
            })),
            ...ledgers.map((ledger) => ({
              value: `ledger:${ledger.id}`,
              label: ledger.name,
              group: 'Ledgers',
            })),
          ]}
        />
      )}
      {tab === 'ledger' && (
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

      {usesPeriod(tab) && (
        <PeriodControls
          key={`${appliedFrom}|${appliedTo}|${appliedCompare}`}
          applied={{ from: appliedFrom, to: appliedTo, compare: appliedCompare }}
          canCompare={isComparable(tab)}
          day={day}
          onApply={applyPeriod}
        />
      )}
    </div>
  );

  if (loading)
    return (
      <div className={styles.page} ref={pageRef}>
        {header}
        <Loading label="Loading…" />
      </div>
    );

  /*
    A failed load keeps the frame for the same reason a slow one does. This used to return the
    message on its own, so the screen a reader had navigated to lost its heading, its period
    controls and its subject picker — leaving nothing to adjust and nothing to try again with,
    on the one screen state where wanting to change something is most likely.
  */
  if (loadError)
    return (
      <div className={styles.page} ref={pageRef}>
        {header}
        <p className={styles.error} role="alert">
          {loadError}
        </p>
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
        <BalanceSheetView report={balanceSheet} money={money} openLedger={openLedger} />
      )}

      {tab === 'profit-loss' && profitLoss && (
        <ProfitLossView
          report={profitLoss}
          money={money}
          monthLabel={monthLabel}
          openLedger={openLedger}
        />
      )}

      {tab === 'trial-balance' && trialBalance && (
        <TrialBalanceView trialBalance={trialBalance} money={money} openLedger={openLedger} />
      )}

      {/*
        The Cash and Bank books are every cash or bank account's statement one after another, drawn
        by the same component the drill-down uses — see LedgerStatement.
      */}
      {(tab === 'cash-book' || tab === 'bank-book') && (
        <CashBankBookView
          books={tab === 'cash-book' ? cashBook : bankBook}
          kind={tab === 'cash-book' ? 'cash' : 'bank'}
          money={money}
          day={day}
        />
      )}

      {tab === 'group-summary' && groupSummary && (
        <GroupSummaryView groups={groupSummary.groups} money={money} openLedger={openLedger} />
      )}

      {tab === 'register' && !subjectType && (
        <p className={styles.empty}>Choose a voucher type to see its register.</p>
      )}
      {tab === 'register' && subjectType && register && (
        <RegisterView register={register} title={typeName(subjectType)} money={money} day={day} />
      )}

      {tab === 'ledger' && !subjectLedgerId && (
        <p className={styles.empty}>Choose an account to see its statement.</p>
      )}
      {tab === 'ledger' && subjectLedgerId && ledgerReport && (
        <LedgerStatement statement={ledgerReport} money={money} day={day} />
      )}

      {tab === 'bank-reconciliation' && !subjectLedgerId && (
        <p className={styles.empty}>Choose a cash or bank account to reconcile.</p>
      )}
      {tab === 'bank-reconciliation' && subjectLedgerId && reconciliation && (
        <BankReconciliationView
          report={reconciliation}
          money={money}
          day={day}
          typeName={typeName}
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

      {tab === 'audit' && audit && <AuditTrailView trail={audit} day={day} />}

      {tab === 'statement-of-account' && !subjectLedgerId && (
        <p className={styles.empty}>Choose a party to see their statement.</p>
      )}
      {tab === 'statement-of-account' && subjectLedgerId && soa && (
        <StatementOfAccountView report={soa} money={money} day={day} />
      )}

      {tab === 'funds-flow' && fundsFlow && <FundsFlowView report={fundsFlow} money={money} />}
      {tab === 'ratios' && ratios && <RatioView report={ratios} money={money} />}
      {tab === 'exceptions' && exceptions && <ExceptionView report={exceptions} />}

      {tab === 'day-book' && dayBook && (
        <DayBookView dayBook={dayBook} money={money} day={day} typeName={typeName} />
      )}

      {tab === 'receipts-payments' && receiptsPayments && (
        <ReceiptsAndPaymentsView report={receiptsPayments} money={money} />
      )}

      {tab === 'cash-flow' && cashFlow && (
        <CashFlowView
          report={cashFlow}
          money={money}
          monthLabel={monthLabel}
          openLedger={openLedger}
        />
      )}

      {(tab === 'receivables' || tab === 'payables') && outstandings && (
        <OutstandingsView outstandings={outstandings} money={money} />
      )}

      {tab === 'forex' && forex && <ForexView forex={forex} money={money} day={day} />}

      <Modal
        open={statement !== null}
        onClose={() => setStatement(null)}
        title={statement ? `${statement.ledger.name} (${statement.ledger.code})` : ''}
      >
        {statement && (
          <>
            <LedgerStatement statement={statement} money={money} day={day} />
            <button type="button" className={styles.closeLink} onClick={() => setStatement(null)}>
              <X size={14} /> Close
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
