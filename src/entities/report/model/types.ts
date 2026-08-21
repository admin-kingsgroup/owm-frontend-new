export type BalanceSide = 'DEBIT' | 'CREDIT';

/**
 * One row of any statement. `kind` plus `id` is what makes a figure clickable — a group id opens a
 * group summary, a ledger id opens that ledger's statement. Amounts stay strings because they are
 * Decimal128 on the server; parsing them into JS numbers here is how a total that must reach zero
 * stops reaching it.
 */
export interface ReportNode {
  kind: 'group' | 'ledger';
  id: string;
  code: string;
  name: string;
  debit: string;
  credit: string;
  balance: string;
  balanceSide: BalanceSide;
  children?: ReportNode[];
}

export interface ReportPeriod {
  financialYearId: string;
  financialYearLabel: string;
  from: string;
  to: string;
}

export interface TrialBalanceRow {
  ledgerId: string;
  accountGroupId: string;
  code: string;
  name: string;
  openingDebit: string;
  openingCredit: string;
  debit: string;
  credit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalanceReport {
  period: ReportPeriod;
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: string;
    openingCredit: string;
    debit: string;
    credit: string;
    closingDebit: string;
    closingCredit: string;
    difference: string;
  };
}

export interface BalanceSheetReport {
  period: ReportPeriod;
  assets: ReportNode[];
  liabilities: ReportNode[];
  totals: {
    assets: string;
    liabilities: string;
    currentPeriodProfit: string;
    difference: string;
  };
}

export interface ProfitAndLossReport {
  period: ReportPeriod;
  income: ReportNode[];
  expenses: ReportNode[];
  totals: { income: string; expenses: string; netProfit: string };
}

export interface LedgerStatementLine {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  voucherTypeId: string;
  narration?: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface LedgerStatementReport {
  period: ReportPeriod;
  ledger: { id: string; code: string; name: string };
  openingBalance: string;
  openingSide: BalanceSide;
  lines: LedgerStatementLine[];
  closingBalance: string;
  closingSide: BalanceSide;
  totals: { debit: string; credit: string };
}

export interface DayBookRow {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  voucherTypeId: string;
  voucherTypeCode: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  narration?: string;
  amount: string;
}

export interface DayBookReport {
  period: ReportPeriod;
  rows: DayBookRow[];
  total: string;
}

/** One company's line on the group overview. Amounts are strings; see `formatMoney`. */
/** One month of a company's movement, for the overview sparkline. */
export interface CompanyTrendPoint {
  /** First day of the month, "YYYY-MM-DD". */
  month: string;
  /** Running cash and bank position at the end of that month. */
  cashAndBank: string;
  /** Profit earned in that month alone, not cumulative. */
  netProfit: string;
}

export interface CompanyOverview {
  companyId: string;
  name: string;
  code: string;
  baseCurrency: string;
  /** Inactive companies are listed but excluded from every group total. */
  status: 'ACTIVE' | 'INACTIVE';
  financialYearId: string | null;
  financialYearLabel: string | null;
  financialYearStatus: 'OPEN' | 'CLOSED' | null;
  cashAndBank: string;
  netProfit: string;
  draftVoucherCount: number;
  trend: CompanyTrendPoint[];
  /** Set when this company's figures could not be computed. The row still appears. */
  error: string | null;
}

export interface GroupOverviewTotalsByCurrency {
  currency: string;
  cashAndBank: string;
  netProfit: string;
}

export interface GroupOverview {
  companies: CompanyOverview[];
  totals: {
    /** One entry per currency in the group — never summed across currencies. */
    byCurrency: GroupOverviewTotalsByCurrency[];
    draftVoucherCount: number;
    /** Active companies — the population the other totals are computed over. */
    companyCount: number;
    openYearCount: number;
    /** Listed, but excluded from every figure above. */
    inactiveCount: number;
  };
}

export interface CashMovementRow {
  ledgerId: string;
  accountGroupId: string;
  code: string;
  name: string;
  amount: string;
}

/**
 * Cash basis: only money that actually moved. An unpaid invoice appears nowhere here, which is why
 * this disagrees with the Profit & Loss for any business that sells on credit — both are right,
 * they answer different questions.
 */
export interface ReceiptsAndPaymentsReport {
  period: ReportPeriod;
  openingBalance: string;
  openingSide: BalanceSide;
  receipts: CashMovementRow[];
  payments: CashMovementRow[];
  closingBalance: string;
  closingSide: BalanceSide;
  totals: { receipts: string; payments: string; difference: string };
}

export interface CashFlowReport {
  period: ReportPeriod;
  openingBalance: string;
  openingSide: BalanceSide;
  inflow: ReportNode[];
  outflow: ReportNode[];
  closingBalance: string;
  closingSide: BalanceSide;
  totals: { inflow: string; outflow: string; netChange: string };
}
