export type AccountNature = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
export type GroupType = 'BALANCE_SHEET' | 'PROFIT_LOSS';

export interface AccountGroup {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  nature: AccountNature;
  groupType: GroupType;
  isSystem: boolean;
  isActive: boolean;
}

export interface CreateAccountGroupInput {
  /**
   * Left out by the form — the server mints one from the name. Only an import passes one, because
   * the file's ledgers and child groups refer to the group by it.
   */
  code?: string;
  name: string;
  parentCode?: string;
  nature: AccountNature;
  groupType: GroupType;
}

export interface UpdateAccountGroupInput {
  name?: string;
  isActive?: boolean;
}
