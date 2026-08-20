export type LedgerType = 'GENERAL' | 'CASH' | 'BANK';
export type BalanceSide = 'DEBIT' | 'CREDIT';

export interface Ledger {
  id: string;
  companyId: string;
  accountGroupId: string;
  code: string;
  name: string;
  ledgerType: LedgerType;
  openingBalance: string;
  openingBalanceType: BalanceSide;
  /** Track this ledger's balance invoice by invoice — required for outstandings and realised FX. */
  maintainBillwise: boolean;
  isSystem: boolean;
  isActive: boolean;
}

export interface CreateLedgerInput {
  code: string;
  name: string;
  accountGroupCode: string;
  ledgerType?: LedgerType;
  openingBalance?: number;
  openingBalanceType?: BalanceSide;
  maintainBillwise?: boolean;
}

export interface UpdateLedgerInput {
  name?: string;
  accountGroupCode?: string;
  ledgerType?: LedgerType;
  openingBalance?: number;
  openingBalanceType?: BalanceSide;
  maintainBillwise?: boolean;
  isActive?: boolean;
}

/**
 * Tally's "Difference in Opening Balances". Amounts are strings because they are Decimal128 on
 * the server — parsing them into a JS number here would reintroduce exactly the rounding error
 * the figure exists to reveal.
 */
export interface OpeningBalanceSummary {
  totalDebit: string;
  totalCredit: string;
  difference: string;
}
