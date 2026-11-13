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
  /**
   * Who the account belongs to, when it belongs to somebody.
   *
   * A Sundry Debtor is a person or a business, not just a balance, and the questions the books
   * raise about one — is this overdue, do we have their GSTIN, are they past the credit we agreed
   * — need the answer stored rather than remembered. All optional: most ledgers are not parties.
   */
  gstin?: string;
  pan?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** A string like every other amount — Decimal128 on the server. */
  creditLimit?: string;
  creditDays?: number;
  /**
   * The bank account a BANK ledger stands for. The server stores the number and the code without
   * spaces or hyphens, in uppercase.
   */
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  /** IFSC for an Indian account; SWIFT/BIC or a local routing code elsewhere. */
  bankCode?: string;
  /** Bank name and branch, as one line. */
  bankName?: string;
  isSystem: boolean;
  isActive: boolean;
}

/** The four bank fields as the form holds them — always strings, empty when not filled in. */
export interface BankDetails {
  bankAccountHolderName: string;
  bankAccountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface CreateLedgerInput {
  /**
   * Left out by the form — the server mints one from the name. Only an import passes one, because
   * the file's other rows refer to the ledger by it.
   */
  code?: string;
  name: string;
  accountGroupCode: string;
  ledgerType?: LedgerType;
  openingBalance?: number;
  openingBalanceType?: BalanceSide;
  maintainBillwise?: boolean;
  currencyCode?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  creditLimit?: number;
  creditDays?: number;
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  bankName?: string;
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
  /** Party details. `null` clears one; omit to leave it as it was. */
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  /** Bank details. `null` clears one; omit to leave it as it was. */
  bankAccountHolderName?: string | null;
  bankAccountNumber?: string | null;
  bankCode?: string | null;
  bankName?: string | null;
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

/** One invoice carried in from the previous books. */
export interface OpeningBillInput {
  reference: string;
  /** "YYYY-MM-DD". */
  billDate: string;
  dueDate?: string;
  amount: number;
}

export interface OpeningBill {
  billId: string;
  reference: string;
  billDate: string;
  dueDate?: string;
  amount: string;
}

/**
 * A party's opening bills, and whether they add up to its opening balance.
 *
 * The difference is reported rather than enforced — somebody entering invoices one at a time is
 * out by the rest of them until the last one is in, and refusing to save until then makes the
 * screen unusable.
 */
export interface OpeningBills {
  ledgerId: string;
  side: BalanceSide;
  bills: OpeningBill[];
  total: string;
  openingBalance: string;
  difference: string;
}
