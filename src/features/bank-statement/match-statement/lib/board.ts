import type { BookLine, StatementLine, StatementWorkspace } from '@/entities/bank-statement';

/**
 * Where one row of the board stands.
 *
 * - `matched` — the book line and the bank line are tied, and the book line carries the bank date.
 * - `suggested` — the matcher paired them; a person still has to confirm.
 * - `draft` — the bank line was missing from the books and a draft voucher was raised for it.
 * - `books-only` — in the books, not on the statement yet: a cheque not presented, a deposit not
 *   yet credited.
 * - `bank-only` — on the statement, not in the books: a charge, interest, a direct transfer.
 * - `ignored` — a bank line a person said needs nothing.
 */
export type RowStatus = 'matched' | 'suggested' | 'draft' | 'books-only' | 'bank-only' | 'ignored';

/** One row of the board: a book line and the bank line facing it, either of which may be missing. */
export interface BoardRow {
  key: string;
  status: RowStatus;
  book?: BookLine;
  line?: StatementLine;
  /** The earlier of the two dates, `YYYY-MM-DD` — what the board sorts by. */
  date: string;
}

/** The day only. The server sends dates as full ISO timestamps at midnight UTC. */
export const dayOf = (value: string): string => value.slice(0, 10);

/** Amount in paise, so totals never pick up a floating-point stray. */
export const paise = (value: string | undefined): number =>
  value ? Math.round(Number(value) * 100) : 0;

export const isDeposit = (line: StatementLine) => paise(line.deposit) > 0;

/** Whether a book line is the same money as a bank line: opposite sides, exactly the same amount. */
export function fits(book: BookLine, line: StatementLine): boolean {
  return isDeposit(line)
    ? paise(book.debit) === paise(line.deposit) && paise(book.debit) > 0
    : paise(book.credit) === paise(line.withdrawal) && paise(book.credit) > 0;
}

/** Pairs every bank line with the book line it is tied to, then adds the book lines left over. */
export function buildRows(workspace: StatementWorkspace): BoardRow[] {
  const byEntry = new Map(workspace.bookLines.map((book) => [book.entryId, book]));
  const used = new Set<string>();
  const rows: BoardRow[] = [];

  for (const line of workspace.lines) {
    let status: RowStatus;
    let book: BookLine | undefined;
    switch (line.status) {
      case 'MATCHED':
        status = 'matched';
        book = line.entryId ? byEntry.get(line.entryId) : undefined;
        break;
      case 'SUGGESTED':
        status = 'suggested';
        book = line.entryId ? byEntry.get(line.entryId) : undefined;
        break;
      case 'VOUCHER_CREATED':
        status = 'draft';
        // A draft has no entry tied yet; its bank-side line is found through the voucher.
        book = workspace.bookLines.find(
          (candidate) =>
            candidate.voucherId === line.voucher?.id &&
            !used.has(candidate.entryId) &&
            fits(candidate, line),
        );
        break;
      case 'IGNORED':
        status = 'ignored';
        break;
      default:
        status = 'bank-only';
    }
    if (book) used.add(book.entryId);
    const dates = [dayOf(line.txnDate)];
    if (book) dates.push(dayOf(book.voucherDate));
    rows.push({ key: `line:${line.id}`, status, line, book, date: dates.sort()[0] });
  }

  for (const book of workspace.bookLines) {
    if (used.has(book.entryId)) continue;
    rows.push({
      key: `entry:${book.entryId}`,
      // Ticked off by hand, with no statement line behind it.
      status: book.reconciledOn ? 'matched' : 'books-only',
      book,
      date: dayOf(book.voucherDate),
    });
  }

  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    // On the same day, a row with a book side first: it reads in voucher order.
    return Number(!a.book) - Number(!b.book);
  });
}

/**
 * Whether a row belongs on the board for a period.
 *
 * Anything still open up to the period's end is shown whatever its date — a cheque from three
 * months ago that the bank has still not shown is exactly what a reconciliation is for. Settled
 * rows are shown only when the bank settled them inside the period, or the board would grow with
 * every month ever reconciled.
 */
export function inPeriod(row: BoardRow, from: string, to: string): boolean {
  if (row.date > to) return false;
  if (row.status !== 'matched' && row.status !== 'ignored') return true;
  const settled = row.line
    ? dayOf(row.line.txnDate)
    : row.book?.reconciledOn
      ? dayOf(row.book.reconciledOn)
      : row.date;
  return settled >= from;
}

/** Whether a row holds the words or the amount being searched for. */
export function matchesSearch(row: BoardRow, query: string): boolean {
  const wanted = query.toLowerCase().replace(/[,₹\s]/g, '');
  if (!wanted) return true;
  const { book, line } = row;
  const text = [
    book?.voucherNumber,
    book?.voucherType,
    book?.particulars,
    book?.narration,
    book?.instrumentNumber,
    book && paise(book.debit) ? book.debit : '',
    book && paise(book.credit) ? book.credit : '',
    line?.description,
    line?.reference,
    line && paise(line.deposit) ? line.deposit : '',
    line && paise(line.withdrawal) ? line.withdrawal : '',
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .replace(/[,\s]/g, '');
  return text.includes(wanted);
}

/**
 * What the bank statement says the account held at the end of the period, and on which day.
 *
 * The running balance on the last line on or before that day, when the bank printed one; else the
 * closing balance of the last upload that ends by then. Null when neither is known — a file with
 * no balance column says nothing about the balance.
 */
export function statementBalance(
  workspace: StatementWorkspace,
  asOf: string,
): { amount: number; date: string } | null {
  let best: StatementLine | undefined;
  for (const line of workspace.lines) {
    if (line.balance === undefined || line.balance === null) continue;
    if (dayOf(line.txnDate) > asOf) continue;
    // Later in the list wins on the same day: the lines come back in the bank's own order.
    if (!best || dayOf(line.txnDate) >= dayOf(best.txnDate)) best = line;
  }
  if (best) return { amount: paise(best.balance), date: dayOf(best.txnDate) };

  const closed = workspace.statements
    .filter(
      (statement) =>
        statement.closingBalance !== undefined &&
        statement.closingBalance !== null &&
        statement.toDate &&
        dayOf(statement.toDate) <= asOf,
    )
    .sort((a, b) => (dayOf(a.toDate!) < dayOf(b.toDate!) ? 1 : -1))[0];
  return closed ? { amount: paise(closed.closingBalance), date: dayOf(closed.toDate!) } : null;
}

export interface GapFigures {
  /** Books' closing balance, money in the account positive. */
  books: number;
  /** Payments in the books the bank has not shown yet — they make the bank's figure higher. */
  notPresented: number;
  notPresentedCount: number;
  /** Receipts in the books the bank has not credited yet — they make the bank's figure lower. */
  notCredited: number;
  notCreditedCount: number;
  /** Money in on the statement and not (yet) posted in the books. */
  bankIn: number;
  bankInCount: number;
  /** Money out on the statement and not (yet) posted in the books. */
  bankOut: number;
  bankOutCount: number;
  /** What the statement should show, if both sides are complete. */
  expected: number;
}

/**
 * The bridge from the books' balance to the bank's, item by item.
 *
 * The book side comes from the reconciliation report, which already knows what was open on the
 * period's last day. The bank side is every statement line up to that day that the books do not
 * hold as a posted, ticked-off line: open lines, lines only proposed, and lines whose draft has
 * not been posted. Ignored lines are left out, since a person said they need nothing.
 */
export function gapFigures(
  report: {
    balanceAsPerBooks: string;
    balanceAsPerBooksSide: 'DEBIT' | 'CREDIT';
    unreconciled: Array<{ debit: string; credit: string }>;
    totals: { unreconciledDebits: string; unreconciledCredits: string };
  },
  workspace: StatementWorkspace,
  asOf: string,
): GapFigures {
  const books =
    paise(report.balanceAsPerBooks) * (report.balanceAsPerBooksSide === 'DEBIT' ? 1 : -1);
  const notPresented = paise(report.totals.unreconciledCredits);
  const notCredited = paise(report.totals.unreconciledDebits);

  let bankIn = 0;
  let bankOut = 0;
  let bankInCount = 0;
  let bankOutCount = 0;
  for (const line of workspace.lines) {
    if (line.status === 'MATCHED' || line.status === 'IGNORED') continue;
    if (dayOf(line.txnDate) > asOf) continue;
    if (isDeposit(line)) {
      bankIn += paise(line.deposit);
      bankInCount += 1;
    } else {
      bankOut += paise(line.withdrawal);
      bankOutCount += 1;
    }
  }

  return {
    books,
    notPresented,
    notPresentedCount: report.unreconciled.filter((row) => paise(row.credit) > 0).length,
    notCredited,
    notCreditedCount: report.unreconciled.filter((row) => paise(row.debit) > 0).length,
    bankIn,
    bankInCount,
    bankOut,
    bankOutCount,
    expected: books + notPresented - notCredited + bankIn - bankOut,
  };
}
