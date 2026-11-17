/** As the server sends them — see the backend's accounting/bank-statement-ocr module. */

export type StatementMatchStrength = 'strong' | 'possible';

export interface StatementMatch {
  entryId: string;
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  voucherTypeCode: string;
  narration?: string;
  instrumentNumber?: string;
  amount: string;
  /** Which way the book line says the money moved, in the statement's terms. */
  direction: 'withdrawal' | 'deposit';
  strength: StatementMatchStrength;
  reasons: string[];
}

export interface StatementLine {
  index: number;
  /** As printed on the statement. */
  date: string | null;
  /** YYYY-MM-DD — the date a confirmed match is reconciled on. */
  bankDate: string | null;
  description: string | null;
  reference: string | null;
  amount: string | null;
  direction: 'withdrawal' | 'deposit' | null;
  balance: string | null;
  match: StatementMatch | null;
  note: string | null;
}

export interface BankStatementMatch {
  ledger: { id: string; code: string; name: string };
  provider: 'ocr_space' | 'grok';
  statement: {
    bankName: string | null;
    accountNumber: string | null;
    periodFrom: string | null;
    periodTo: string | null;
    openingBalance: string | null;
    closingBalance: string | null;
  };
  lines: StatementLine[];
  summary: {
    lines: number;
    matched: number;
    strong: number;
    possible: number;
    unmatched: number;
    openBookLines: number;
  };
  warnings: string[];
  meta: {
    model: string | null;
    structuredBy: 'provider_model' | 'pattern_rules' | null;
    pageCount: number | null;
    fileSizeBytes: number;
    durationMs: number;
  };
}

/** One match a person ticked: reconcile this line on the statement's date. */
export interface ConfirmedMatch {
  voucherId: string;
  entryId: string;
  bankDate: string;
}

export interface ReconcileOutcome {
  reconciled: string[];
  failed: Array<{ entryId: string; message: string }>;
}
