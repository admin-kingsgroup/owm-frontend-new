export type AgeingBucket = 'NOT_DUE' | '0_30' | '31_60' | '61_90' | 'OVER_90';

export interface OutstandingBill {
  billId: string;
  ledgerId: string;
  ledgerCode: string;
  ledgerName: string;
  reference: string;
  billDate: string;
  dueDate?: string;
  side: 'DEBIT' | 'CREDIT';
  amount: string;
  settled: string;
  outstanding: string;
  /** Days past due; negative means not yet due. */
  overdueDays: number;
  bucket: AgeingBucket;
  /** Only on a bill raised in a currency other than the company's own. */
  currencyCode?: string;
  fcAmount?: string;
  fcOutstanding?: string;
}

export interface OutstandingsReport {
  asOf: string;
  side: 'DEBIT' | 'CREDIT';
  bills: OutstandingBill[];
  totals: { outstanding: string; byBucket: Record<AgeingBucket, string> };
}
