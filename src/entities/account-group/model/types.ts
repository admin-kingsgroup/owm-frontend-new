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
  code: string;
  name: string;
  parentCode?: string;
  nature: AccountNature;
  groupType: GroupType;
}

export interface UpdateAccountGroupInput {
  name?: string;
  isActive?: boolean;
}
