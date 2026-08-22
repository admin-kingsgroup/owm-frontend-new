export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type AllocationType = 'NEW_REF' | 'AGAINST_REF' | 'ADVANCE' | 'ON_ACCOUNT';

/** One line of a party entry's bill-wise breakdown. Must total the entry it belongs to. */
export interface BillAllocationInput {
  allocationType: AllocationType;
  /** Required except for ON_ACCOUNT — names the bill to raise or settle. */
  reference?: string;
  amount: number;
  /** NEW_REF only. Drives the ageing buckets in Receivables and Payables. */
  dueDate?: string;
}

export interface VoucherEntryInput {
  ledgerCode: string;
  /** In the entry's own currency when `currencyCode` is set, otherwise the base currency. */
  debit: number;
  credit: number;
  narration?: string;
  billAllocations?: BillAllocationInput[];
  /** Post this line in another currency; the server converts it at the rate for the voucher date. */
  currencyCode?: string;
  /** Overrides the rate table for this line — the actual rate the bank gave. */
  exchangeRate?: number;
}

export interface VoucherEntry {
  id: string;
  ledgerId: string;
  ledgerCode: string;
  /** Always the base currency, whatever the line was entered in. */
  debit: string;
  credit: string;
  /**
   * Present only on a line entered in another currency. Without these the converted figure is all
   * there is, and 80,000 says nothing about the 1,000 dollars and the rate of 80 behind it.
   */
  currencyId?: string;
  currencyCode?: string;
  fcAmount?: string;
  exchangeRate?: string;
  narration?: string;
}

export interface VoucherSummary {
  id: string;
  companyId: string;
  voucherTypeId: string;
  voucherNumber: string;
  voucherDate: string;
  referenceNumber?: string;
  narration?: string;
  status: VoucherStatus;
  createdBy: string;
  postedAt?: string;
  cancelledAt?: string;
}

export interface Voucher extends VoucherSummary {
  entries: VoucherEntry[];
}

export interface CreateVoucherInput {
  voucherTypeCode: string;
  voucherDate: string;
  referenceNumber?: string;
  narration?: string;
  entries: VoucherEntryInput[];
}

export interface VoucherListQuery {
  voucherTypeCode?: string;
  status?: VoucherStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface VoucherListResult {
  items: VoucherSummary[];
  total: number;
  page: number;
  limit: number;
}
