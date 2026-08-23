import type {
  AuditList,
  BalanceSheetReport,
  BankReconciliationReport,
  CashFlowReport,
  DayBookReport,
  ExceptionReport,
  GroupSummaryReport,
  FundsFlowReport,
  LedgerStatementReport,
  MonthlySummaryReport,
  ProfitAndLossReport,
  RatioReport,
  ReceiptsAndPaymentsReport,
  CashMovementRow,
  ReportPeriod,
  StatementOfAccountReport,
  TrialBalanceReport,
} from '@/entities/report';
import type { OutstandingsReport } from '@/entities/outstanding';
import type { ForexGainLossReport } from '@/entities/currency';
import { toCalendarDay } from '@/shared/lib';

import { downloadCsv, flattenNodes } from './export-csv';
import type { Tab } from './tabs';

/**
 * Every report the screen may have loaded. One bag rather than twenty arguments: the writer needs
 * whichever one the open tab refers to, and a caller that has to remember the order of twenty
 * positional parameters will eventually get two of them the wrong way round.
 *
 * All nullable, because the screen writes them as they arrive and a report that failed stays null
 * — which is also why every branch below checks before it writes.
 */
export interface LoadedReports {
  balanceSheet: BalanceSheetReport | null;
  profitLoss: ProfitAndLossReport | null;
  trialBalance: TrialBalanceReport | null;
  dayBook: DayBookReport | null;
  receiptsPayments: ReceiptsAndPaymentsReport | null;
  cashFlow: CashFlowReport | null;
  receivables: OutstandingsReport | null;
  payables: OutstandingsReport | null;
  forex: ForexGainLossReport | null;
  cashBook: LedgerStatementReport[] | null;
  bankBook: LedgerStatementReport[] | null;
  groupSummary: GroupSummaryReport | null;
  register: DayBookReport | null;
  ledgerReport: LedgerStatementReport | null;
  reconciliation: BankReconciliationReport | null;
  monthly: MonthlySummaryReport | null;
  audit: AuditList | null;
  soa: StatementOfAccountReport | null;
  fundsFlow: FundsFlowReport | null;
  ratios: RatioReport | null;
  exceptions: ExceptionReport | null;
}

interface ExportContext {
  /** Which voucher type the register is showing, for the file's name. */
  subjectType: string;
  /** The financial year the open report covers, for the file's name. Empty when it has none. */
  periodLabel: string;
  /**
   * The date the as-at reports were run to, for their file's name.
   *
   * Ageing and forex answer a single date rather than a span, so they have no financial year to be
   * named after — and named after nothing they saved as "receivables-report.csv", which is the
   * same undated file the year stamp exists to prevent. Empty when no date was applied, in which
   * case the server used the year's end and the file falls back to "report".
   */
  asOf: string;
}

/**
 * Writes whichever report is open to a CSV file.
 *
 * Amounts go out exactly as the server sent them. They are decimal strings, and a spreadsheet
 * reparsing a formatted one is how a trial balance stops totalling zero — so `money` is used for
 * nothing but the odd heading. A comparison column is added only where there is a comparison, so a
 * file exported without one keeps the shape anything downstream was built against.
 *
 * Lifted out of the page because it was a quarter of it and shares nothing with rendering: it
 * reads the same reports and answers a different question.
 */
/**
 * The period the open report was built from, or undefined when it has not been read yet.
 *
 * Keyed on the open tab rather than picking the first report that happens to be loaded. Reports
 * stay in state once read, so a "first non-null" rule would print the balance sheet's period above
 * the funds flow — and if the reader had changed the dates since, it would be the wrong period,
 * stated with the same confidence as the right one.
 *
 * Cash Book and Bank Book are lists of statements and take theirs from the first; each covers the
 * same span, since they are all cut from one request. Reports that are only ever about a subject
 * return undefined until that subject is chosen, which is when there is genuinely nothing to state.
 */
export function periodOf(tab: Tab, reports: LoadedReports): ReportPeriod | undefined {
  switch (tab) {
    case 'balance-sheet':
      return reports.balanceSheet?.period;
    case 'profit-loss':
      return reports.profitLoss?.period;
    case 'trial-balance':
      return reports.trialBalance?.period;
    case 'day-book':
      return reports.dayBook?.period;
    case 'receipts-payments':
      return reports.receiptsPayments?.period;
    case 'cash-flow':
      return reports.cashFlow?.period;
    case 'cash-book':
      return reports.cashBook?.[0]?.period;
    case 'bank-book':
      return reports.bankBook?.[0]?.period;
    case 'group-summary':
      return reports.groupSummary?.period;
    case 'register':
      return reports.register?.period;
    case 'ledger':
      return reports.ledgerReport?.period;
    case 'bank-reconciliation':
      return reports.reconciliation?.period;
    case 'monthly-summary':
      return reports.monthly?.period;
    case 'statement-of-account':
      return reports.soa?.period;
    case 'funds-flow':
      return reports.fundsFlow?.period;
    case 'ratios':
      return reports.ratios?.period;
    case 'exceptions':
      return reports.exceptions?.period;
    case 'receivables':
    case 'payables':
    case 'forex':
      /*
        Ageing and forex are as at a single date, not across a span, and each states that date in
        its own heading. A financial year printed above them would describe something they do not
        show.
      */
      return undefined;
    case 'audit':
      // Ordered by when a change was made, not by the dates of what was changed.
      return undefined;
  }
}

export function exportReport(tab: Tab, reports: LoadedReports, context: ExportContext): void {
  const {
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
  } = reports;
  const { subjectType, periodLabel, asOf } = context;

  /*
    The year in the file's name comes from the report being written, not from the balance sheet.
    It used to read the balance sheet's period, which is no longer loaded unless somebody is
    looking at it — every other report would have been saved as "…-report.csv" with no year in it,
    and a saved file with no year is the one thing nobody can put back in order later.

    The reports that answer a single date rather than a span carry that date instead, for the same
    reason: they have no financial year to be named after, and three of them were saving undated.

    The audit trail is not one of them. It is ordered by when a change was made and ignores the
    period entirely, so stamping it with the date the boxes happen to hold would put a claim on the
    file that its contents do not support.
  */
  const asAtReport = tab === 'receivables' || tab === 'payables' || tab === 'forex';
  const stamp = periodLabel || (asAtReport ? asOf : '') || 'report';
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
  } else if ((tab === 'cash-book' || tab === 'bank-book') && (cashBook || bankBook)) {
    /*
        Every cash or bank account's statement, one after another. The account is a column rather
        than a heading between blocks: a heading row is a spreadsheet's least useful shape, and a
        column can be filtered and grouped by whoever opens the file.
      */
    const books = (tab === 'cash-book' ? cashBook : bankBook) ?? [];
    downloadCsv(
      name(tab),
      ['Account', 'Date', 'Number', 'Narration', 'Debit', 'Credit', 'Running balance'],
      books.flatMap((book) => [
        [book.ledger.name, '', 'Opening', '', '', '', book.openingBalance],
        ...book.lines.map((line) => [
          book.ledger.name,
          toCalendarDay(line.voucherDate),
          line.voucherNumber,
          line.narration ?? '',
          line.debit,
          line.credit,
          line.runningBalance,
        ]),
        [
          book.ledger.name,
          '',
          'Closing',
          '',
          book.totals.debit,
          book.totals.credit,
          book.closingBalance,
        ],
      ]),
    );
  } else if (tab === 'group-summary' && groupSummary) {
    downloadCsv(name('group-summary'), base, flattenNodes(groupSummary.groups));
  } else if (tab === 'register' && register) {
    downloadCsv(
      name(`${subjectType.toLowerCase()}-register`),
      ['Date', 'Number', 'Type', 'Narration', 'Status', 'Amount'],
      register.rows.map((row) => [
        toCalendarDay(row.voucherDate),
        row.voucherNumber,
        row.voucherTypeCode,
        row.narration ?? '',
        row.status,
        row.amount,
      ]),
    );
  } else if (tab === 'ledger' && ledgerReport) {
    downloadCsv(
      name(`ledger-${ledgerReport.ledger.code.toLowerCase()}`),
      ['Date', 'Number', 'Narration', 'Debit', 'Credit', 'Running balance'],
      ledgerReport.lines.map((line) => [
        toCalendarDay(line.voucherDate),
        line.voucherNumber,
        line.narration ?? '',
        line.debit,
        line.credit,
        line.runningBalance,
      ]),
    );
  } else if (tab === 'bank-reconciliation' && reconciliation) {
    downloadCsv(
      name(`bank-reconciliation-${reconciliation.ledger.code.toLowerCase()}`),
      ['Date', 'Number', 'Type', 'Instrument', 'Narration', 'Debit', 'Credit'],
      [
        ...reconciliation.unreconciled.map((row) => [
          toCalendarDay(row.voucherDate),
          row.voucherNumber,
          row.voucherTypeCode,
          row.instrumentNumber ?? '',
          row.narration ?? '',
          row.debit,
          row.credit,
        ]),
        ['', 'Balance as per books', '', '', '', reconciliation.balanceAsPerBooks, ''],
        ['', 'Balance as per bank', '', '', '', reconciliation.totals.balanceAsPerBank, ''],
      ],
    );
  } else if (tab === 'monthly-summary' && monthly) {
    downloadCsv(
      name(`monthly-${monthly.subject.code.toLowerCase()}`),
      ['Month', 'Debit', 'Credit', 'Closing', 'Side'],
      [
        ['Opening', '', '', monthly.opening, monthly.openingSide],
        ...monthly.months.map((month) => [
          month.month,
          month.debit,
          month.credit,
          month.closing,
          month.closingSide,
        ]),
        [
          'Total',
          monthly.totals.debit,
          monthly.totals.credit,
          monthly.totals.closing,
          monthly.totals.closingSide,
        ],
      ],
    );
  } else if (tab === 'audit' && audit) {
    downloadCsv(
      name('audit-trail'),
      ['When', 'Entity', 'Id', 'Action', 'By', 'Summary', 'Before', 'After'],
      audit.rows.map((row) => [
        row.at,
        row.entity,
        row.entityId,
        row.action,
        // Blank, not "system": the trail records that it does not know, and so does the file.
        row.userId ?? '',
        row.summary,
        row.before ? JSON.stringify(row.before) : '',
        row.after ? JSON.stringify(row.after) : '',
      ]),
    );
  } else if (tab === 'statement-of-account' && soa) {
    downloadCsv(
      name(`statement-${soa.party.code.toLowerCase()}`),
      ['Section', 'Date', 'Reference', 'Narration', 'Debit', 'Credit', 'Outstanding'],
      [
        ...soa.statement.lines.map((line) => [
          'Movement',
          toCalendarDay(line.voucherDate),
          line.voucherNumber,
          line.narration ?? '',
          line.debit,
          line.credit,
          '',
        ]),
        ...soa.openBills.map((bill) => [
          'Open invoice',
          toCalendarDay(bill.billDate),
          bill.reference,
          bill.dueDate ? `due ${toCalendarDay(bill.dueDate)}` : '',
          bill.amount,
          bill.settled,
          bill.outstanding,
        ]),
        ['Total', '', '', '', '', '', soa.totals.openTotal],
      ],
    );
  } else if (tab === 'funds-flow' && fundsFlow) {
    downloadCsv(
      name('funds-flow'),
      ['Side', 'Code', 'Name', 'Amount'],
      [
        ...fundsFlow.sources.map((line) => ['Source', line.code, line.name, line.amount]),
        ...fundsFlow.applications.map((line) => ['Application', line.code, line.name, line.amount]),
        ['Total', '', 'Sources', fundsFlow.totals.sources],
        ['Total', '', 'Applications', fundsFlow.totals.applications],
      ],
    );
  } else if (tab === 'ratios' && ratios) {
    downloadCsv(
      name('ratios'),
      ['Ratio', 'Value', 'Unit', 'From', 'Over'],
      ratios.ratios.map((line) => [
        line.label,
        // Empty, not zero: a ratio with nothing to divide by is unanswerable, not nil.
        line.value ?? '',
        line.unit,
        line.numerator,
        line.denominator,
      ]),
    );
  } else if (tab === 'exceptions' && exceptions) {
    downloadCsv(
      name('exceptions'),
      ['Severity', 'Kind', 'What it is', 'Entity', 'Id'],
      exceptions.exceptions.map((line) => [
        line.severity,
        line.kind,
        line.message,
        line.entity ?? '',
        line.entityId ?? '',
      ]),
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
