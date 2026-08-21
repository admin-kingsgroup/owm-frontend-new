export type VoucherCategory =
  | 'SALES'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

/**
 * AUTO                 — the app assigns the number and rejects one that is supplied.
 * AUTO_MANUAL_OVERRIDE — auto by default, but a number may be typed over it.
 * MANUAL               — every number is typed.
 */
export type NumberingMethod = 'AUTO' | 'AUTO_MANUAL_OVERRIDE' | 'MANUAL';

export type ResetFrequency =
  'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export type VoucherNumberFormat = 'COMPANY_PREFIXED' | 'TALLY_STYLE';

/** How a voucher number is built. Editable only until the type has issued its first number. */
export interface NumberingConfig {
  prefix: string;
  suffix: string;
  numberLength: number;
  prefillWithZero: boolean;
  numberFormat: VoucherNumberFormat;
  resetFrequency: ResetFrequency;
  startingNumber: number;
}

export interface VoucherType {
  id: string;
  companyId: string;
  code: string;
  name: string;
  category: VoucherCategory;
  numberingMethod: NumberingMethod;
  numbering: NumberingConfig;
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
  numbering?: Partial<NumberingConfig>;
  isActive?: boolean;
}
