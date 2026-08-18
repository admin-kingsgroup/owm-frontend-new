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
}

export interface UpdateLedgerInput {
  name?: string;
  accountGroupCode?: string;
  ledgerType?: LedgerType;
  openingBalance?: number;
  openingBalanceType?: BalanceSide;
  isActive?: boolean;
}
