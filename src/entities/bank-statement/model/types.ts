/** How the file reached us. `PDF_OCR` is a scanned PDF whose text was read off the page image. */
export type StatementFormat = 'CSV' | 'XLSX' | 'XML' | 'PDF' | 'PDF_OCR';

/**
 * What became of one bank line.
 *
 * - `UNMATCHED` — nothing in the books is tied to it yet.
 * - `SUGGESTED` — the matcher found its book line; waiting for a person to confirm.
 * - `MATCHED` — tied to a posted book line, which carries the bank's date.
 * - `VOUCHER_CREATED` — missing from the books; a draft voucher was raised for it.
 * - `IGNORED` — a person said it needs nothing.
 */
export type StatementLineStatus =
  'UNMATCHED' | 'SUGGESTED' | 'MATCHED' | 'VOUCHER_CREATED' | 'IGNORED';

/** One line as read from the file and checked by the person, ready to send. */
export interface StatementLineInput {
  /** `YYYY-MM-DD`. */
  txnDate: string;
  valueDate?: string;
  description: string;
  reference?: string;
  /** Money out of the account, as text: "1234.50" or "0". */
  withdrawal: string;
  /** Money into the account. */
  deposit: string;
  /** Running balance, when the statement shows one. Negative for an overdraft. */
  balance?: string;
}

export interface UploadStatementInput {
  fileName: string;
  format: StatementFormat;
  columnMap?: Record<string, unknown>;
  openingBalance?: string;
  closingBalance?: string;
  lines: StatementLineInput[];
}

export interface UploadStatementResult {
  statementId: string;
  received: number;
  stored: number;
  duplicates: number;
  suggested: number;
}

export interface MatchCandidate {
  entryId: string;
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  narration?: string;
  instrumentNumber?: string;
  /** Bank date minus book date, in days. */
  daysApart: number;
  referenceMatch: boolean;
}

export interface StatementLine {
  id: string;
  statementId: string;
  txnDate: string;
  valueDate?: string;
  description: string;
  reference?: string;
  withdrawal: string;
  deposit: string;
  balance?: string;
  status: StatementLineStatus;
  matchNote?: string;
  entryId?: string;
  voucher?: { id: string; voucherNumber: string; voucherDate: string; status: string };
  candidates?: MatchCandidate[];
  suggestedLedgerId?: string;
}

export interface StatementSummary {
  id: string;
  fileName: string;
  format: StatementFormat;
  fromDate?: string;
  toDate?: string;
  openingBalance?: string;
  closingBalance?: string;
  lineCount: number;
  createdAt: string;
}

/** One line of the bank account in the books, as the reconciliation board shows it. */
export interface BookLine {
  entryId: string;
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  /** The voucher type's own name: "Receipt", "Payment". */
  voucherType: string;
  /** `DRAFT` for a voucher raised from the statement and not posted yet. */
  voucherStatus: string;
  /** The voucher's other side — the ledger the money came from or went to. */
  particulars: string;
  narration?: string;
  instrumentNumber?: string;
  /** Money into the account. */
  debit: string;
  /** Money out of the account. */
  credit: string;
  /** The day the bank showed it; absent while still open. */
  reconciledOn?: string;
}

export interface StatementWorkspace {
  ledger: { id: string; code: string; name: string };
  statements: StatementSummary[];
  lastColumnMap: Record<string, unknown> | null;
  lines: StatementLine[];
  counts: Record<StatementLineStatus, number>;
  /** Open book lines, plus the ones a statement line is tied to. */
  bookLines: BookLine[];
}

export interface LineOutcome {
  lineId: string;
  voucherId?: string;
  voucherNumber?: string;
  error?: string;
}

export interface BatchResult {
  done: LineOutcome[];
  failed: LineOutcome[];
}
