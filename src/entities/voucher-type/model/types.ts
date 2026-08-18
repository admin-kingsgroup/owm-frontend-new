export type VoucherCategory =
  | 'SALES'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type NumberingMethod = 'AUTO' | 'MANUAL';

export interface VoucherType {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: VoucherCategory;
  numberingMethod: NumberingMethod;
  isSystem: boolean;
  isActive: boolean;
  configuration: Record<string, unknown>;
}

export interface CreateVoucherTypeInput {
  code: string;
  name: string;
  category: VoucherCategory;
  numberingMethod?: NumberingMethod;
}

export interface UpdateVoucherTypeInput {
  name?: string;
  numberingMethod?: NumberingMethod;
  isActive?: boolean;
}
