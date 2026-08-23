
/**
 * Which reports exist, what they are called, and what each of them takes.
 *
 * Lifted out of the page because three other modules ask the same questions of a tab — the export
 * writer, the loader and the page itself — and three copies of "is this one comparable" is three
 * chances for a control to appear on a report that cannot answer it.
 */
export const TAB_IDS = [
  'balance-sheet',
  'profit-loss',
  'trial-balance',
  'day-book',
  'cash-book',
  'bank-book',
  'group-summary',
  'receipts-payments',
  'cash-flow',
  'receivables',
  'payables',
  'forex',
  /*
    The five that are about one thing rather than about the whole company. Each names its subject
    in the address — ?report=register&type=SALES, ?report=ledger&ledgerId=… — so a particular
    register or a particular account's statement is as bookmarkable as any other report.
  */
  'register',
  'ledger',
  'bank-reconciliation',
  'monthly-summary',
  'audit',
  'statement-of-account',
  'funds-flow',
  'ratios',
  'exceptions',
] as const;

export type Tab = (typeof TAB_IDS)[number];

export function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

/** Named once, for the heading of whichever report is open. The menu carries the same names. */
export const TAB_LABELS: Record<Tab, string> = {
  register: 'Register',
  ledger: 'Ledger',
  'bank-reconciliation': 'Bank Reconciliation',
  'monthly-summary': 'Monthly Summary',
  audit: 'Audit Trail',
  'statement-of-account': 'Statement of Account',
  'funds-flow': 'Funds Flow',
  ratios: 'Ratios',
  exceptions: 'Exceptions',
  'balance-sheet': 'Balance Sheet',
  'profit-loss': 'Profit & Loss',
  'trial-balance': 'Trial Balance',
  'day-book': 'Day Book',
  'cash-book': 'Cash Book',
  'bank-book': 'Bank Book',
  'group-summary': 'Group Summary',
  'receipts-payments': 'Receipts & Payments',
  'cash-flow': 'Cash Flow',
  receivables: 'Receivables',
  payables: 'Payables',
  forex: 'Forex Gain/Loss',
};


/**
 * The two statements the server answers a comparison for. The flag rides along on every report
 * request, but the rest ignore it, so offering the control on those reports would be offering a
 * tick box that does nothing — worse than not offering it, because the reader is left to wonder
 * whether the two years really did match.
 */

/**
 * Whether the period boxes apply to this report at all.
 *
 * Only the audit trail does not take one: it is ordered by when a change was made rather than by
 * the dates of the vouchers changed, and offering the same From/To boxes would be one control
 * meaning two different things depending on which tab is open.
 */
export function usesPeriod(tab: Tab): boolean {
  return tab !== 'audit';
}

export function isComparable(tab: Tab): boolean {
  return (
    tab === 'balance-sheet' ||
    tab === 'profit-loss' ||
    tab === 'trial-balance' ||
    tab === 'receipts-payments' ||
    tab === 'cash-flow'
  );
}
