export type VoucherStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface VoucherEntryInput {
  ledgerCode: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface VoucherEntry {
  id: string;
  ledgerId: string;
  ledgerCode: string;
  debit: string;
  credit: string;
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
