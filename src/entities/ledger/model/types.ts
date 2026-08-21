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
  /**
   * The currency this account is denominated in. Absent means the company's base currency, which
   * is most accounts. Set on the accounts of a counterparty who keeps their own books in another
   * currency, and inherited by every voucher line posted against it.
   */
  currencyId?: string;
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
  currencyCode?: string;
}

export interface UpdateLedgerInput {
  name?: string;
  accountGroupCode?: string;
  ledgerType?: LedgerType;
  openingBalance?: number;
  openingBalanceType?: BalanceSide;
  maintainBillwise?: boolean;
  /** `null` clears it, returning the account to the base currency. Omit to leave it unchanged. */
  currencyCode?: string | null;
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
