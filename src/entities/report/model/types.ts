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
