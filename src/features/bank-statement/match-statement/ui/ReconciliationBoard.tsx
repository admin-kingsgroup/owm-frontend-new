import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  confirmStatementMatches,
  createStatementVouchers,
  deleteStatement,
  getStatementWorkspace,
  ignoreStatementLine,
  matchStatementLine,
  postStatementVouchers,
  rerunStatementMatch,
  undoStatementLine,
  type BatchResult,
  type StatementSummary,
  type StatementWorkspace,
} from '@/entities/bank-statement';
import type { BankReconciliationReport } from '@/entities/report';
import { reconcileEntry } from '@/entities/voucher';
import { cn, getErrorMessage } from '@/shared/lib';
import { Button, ConfirmDialog, Select, toast } from '@/shared/ui';

import {
  buildRows,
  dayOf,
  fits,
  gapFigures,
  inPeriod,
  isDeposit,
  matchesSearch,
  paise,
  statementBalance,
  type BoardRow,
  type RowStatus,
} from '../lib/board';
import styles from './ReconciliationBoard.module.css';

export interface LedgerOption {
  id: string;
  name: string;
}

interface ReconciliationBoardProps {
  companyId: string;
  ledgerId: string;
  ledgerName: string;
  /** Every active ledger a voucher's other side could be, this bank account left out. */
  ledgers: LedgerOption[];
  /** The books' figures for the period: the balance, and what was still open on its last day. */
  report: BankReconciliationReport;
  money: (value: string) => string;
  day: (value: string) => string;
  /** Changes whenever the caller wants the board to read again — after an upload, say. */
  refreshKey: number;
  /** Buttons for the board's header, such as the upload button the page owns. */
  actions?: ReactNode;
  /** The workspace as last read, for the caller to take the saved column mapping from. */
  onLoaded?: (workspace: StatementWorkspace) => void;
  /** The books' reconciliation marks moved; the report's figures should be read again. */
  onBooksChanged: () => void;
}

type Filter = 'all' | RowStatus;
type Layout = 'pair' | 'list';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'suggested', label: 'To confirm' },
  { id: 'books-only', label: 'Only in books' },
  { id: 'bank-only', label: 'Only in bank' },
  { id: 'draft', label: 'Drafts' },
  { id: 'matched', label: 'Matched' },
  { id: 'ignored', label: 'Ignored' },
];

const STATUS_LABEL: Record<RowStatus, string> = {
  matched: 'Matched',
  suggested: 'Suggested',
  draft: 'Draft voucher',
  'books-only': 'Not in bank yet',
  'bank-only': 'Not in books',
  ignored: 'Ignored',
};

const LAYOUT_KEY = 'owm.reconciliation.layout';

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'pair';
  } catch {
    return 'pair';
  }
}

function summarise(result: BatchResult, verb: string): void {
  if (result.done.length > 0) {
    toast.success(`${result.done.length} line${result.done.length === 1 ? '' : 's'} ${verb}`);
  }
  if (result.failed.length > 0) {
    const first = result.failed[0].error ?? 'unknown reason';
    toast.error(
      `${result.failed.length} line${result.failed.length === 1 ? '' : 's'} could not be ${verb}: ${first}`,
    );
  }
}

/** "Same day", "Bank 2 days later" — how far the bank's date is from the voucher's. */
function describeGap(bookDate: string, bankDate: string): string {
  const days = Math.round((Date.parse(dayOf(bankDate)) - Date.parse(dayOf(bookDate))) / 864e5);
  if (days === 0) return 'Same day';
  const count = Math.abs(days);
  return `Bank ${count} day${count === 1 ? '' : 's'} ${days > 0 ? 'later' : 'earlier'}`;
}

/**
 * The books and the bank statement, face to face.
 *
 * The left side is the bank account as the books hold it; the right side is the statement the
 * bank sent. A row holds one book line and the bank line it is the same money as, so whatever has
 * no partner shows at a glance as a striped gap on the other side. The narrow lane between them
 * says what each row needs: confirm a match the matcher found, raise a voucher for a bank charge,
 * or nothing at all for a cheque the bank has not shown yet.
 *
 * Below, the gap between the two balances is bridged item by item, so a reader can hold the last
 * figure against the statement in hand.
 */
export function ReconciliationBoard({
  companyId,
  ledgerId,
  ledgerName,
  ledgers,
  report,
  money,
  day,
  refreshKey,
  actions,
  onLoaded,
  onBooksChanged,
}: ReconciliationBoardProps) {
  const [workspace, setWorkspace] = useState<StatementWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<Layout>(readLayout);
  const [contra, setContra] = useState<Record<string, string>>({});
  const [candidate, setCandidate] = useState<Record<string, string>>({});
  const [pickedEntry, setPickedEntry] = useState<string | null>(null);
  const [pickedLine, setPickedLine] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ key: string; side: 'book' | 'bank' } | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [removing, setRemoving] = useState<StatementSummary | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const from = dayOf(report.period.from);
  const asOf = dayOf(report.asOf);

  const apply = useCallback(
    (next: StatementWorkspace) => {
      setWorkspace(next);
      onLoaded?.(next);
      setError(null);
      setPickedEntry(null);
      setPickedLine(null);
      // Fill in the suggested ledger for every open line not already chosen by hand.
      setContra((current) => {
        const filled = { ...current };
        for (const line of next.lines) {
          if (line.status === 'UNMATCHED' && line.suggestedLedgerId && !filled[line.id]) {
            filled[line.id] = line.suggestedLedgerId;
          }
        }
        return filled;
      });
    },
    [onLoaded],
  );

  useEffect(() => {
    let cancelled = false;
    getStatementWorkspace(companyId, ledgerId)
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'The statement could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, ledgerId, apply, refreshKey]);

  // In the two-list layout, bring the partner of the clicked line into view.
  useEffect(() => {
    if (!focus || !scroller.current) return;
    const other = focus.side === 'book' ? 'bank' : 'book';
    scroller.current
      .querySelector(`[data-side="${other}"][data-key="${CSS.escape(focus.key)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focus]);

  /** Runs an action, then reads the board again — and the report's figures, if the books moved. */
  async function act(work: () => Promise<void>, booksMoved = true) {
    setBusy(true);
    setError(null);
    try {
      await work();
      apply(await getStatementWorkspace(companyId, ledgerId));
      if (booksMoved) onBooksChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'That did not work'));
    } finally {
      setBusy(false);
    }
  }

  function chooseLayout(next: Layout) {
    setLayout(next);
    setFocus(null);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* A remembered layout is a convenience; without storage the board still works. */
    }
  }

  const rows = useMemo(
    () => (workspace ? buildRows(workspace).filter((row) => inPeriod(row, from, asOf)) : []),
    [workspace, from, asOf],
  );

  if (!workspace) {
    return (
      <section className={styles.board}>
        <header className={styles.head}>
          <h2 className={styles.title}>Reconcile with the bank statement</h2>
          <div className={styles.headActions}>{actions}</div>
        </header>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <p className={styles.muted}>Loading…</p>
        )}
      </section>
    );
  }

  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status] += 1;
      return acc;
    },
    { matched: 0, suggested: 0, draft: 0, 'books-only': 0, 'bank-only': 0, ignored: 0 } as Record<
      RowStatus,
      number
    >,
  );
  const shown = rows.filter(
    (row) => (filter === 'all' || row.status === filter) && matchesSearch(row, query),
  );
  const hasStatement = workspace.statements.length > 0;
  const readyDrafts = rows.filter(
    (row) => row.status === 'bank-only' && row.line && contra[row.line.id],
  );

  /* ---------- the figures above and below ---------- */

  const bankBalance = statementBalance(workspace, asOf);
  const gap = gapFigures(report, workspace, asOf);
  const amount = (value: number) => money((Math.abs(value) / 100).toFixed(2));
  const signed = (value: number) => `${value < 0 ? '−' : ''}${amount(value)}`;
  const bankLinesInPeriod = rows.filter((row) => row.line).length;
  const bankLinesTicked = rows.filter((row) => row.line && row.status === 'matched').length;
  const unexplained = bankBalance ? bankBalance.amount - gap.expected : null;

  /* ---------- picking one line on each side to match by hand ---------- */

  const pickBook = pickedEntry
    ? workspace.bookLines.find((book) => book.entryId === pickedEntry)
    : undefined;
  const pickLine = pickedLine ? workspace.lines.find((line) => line.id === pickedLine) : undefined;
  const pickFits = pickBook && pickLine ? fits(pickBook, pickLine) : false;

  /* ---------- cells ---------- */

  const statusBadge = (status: RowStatus) => (
    <span className={styles.badge} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );

  const bookCells = (row: BoardRow, inList: boolean) => {
    const { book } = row;
    if (!book) {
      return (
        <td colSpan={5} className={cn(styles.b, styles.gap)}>
          {inList ? '' : 'Not in your books'}
        </td>
      );
    }
    const focused = focus?.key === row.key;
    const pickable = row.status === 'books-only';
    const detail = [
      `${book.voucherType}${book.voucherStatus === 'DRAFT' ? ' (draft)' : ''}`,
      book.instrumentNumber,
      book.narration,
    ]
      .filter(Boolean)
      .join(' · ');
    const cell = cn(styles.b, focused && styles.focused);
    const onClick = inList ? () => setFocus({ key: row.key, side: 'book' }) : undefined;
    return (
      <>
        <td
          className={cn(cell, styles.pick, styles.edge)}
          data-status={row.status}
          data-side="book"
          data-key={row.key}
        >
          {pickable && (
            <input
              type="checkbox"
              className={styles.check}
              aria-label={`Pick ${book.voucherNumber} to match by hand`}
              checked={pickedEntry === book.entryId}
              onChange={(event) => setPickedEntry(event.target.checked ? book.entryId : null)}
            />
          )}
        </td>
        <td className={cell} onClick={onClick}>
          <span className={styles.date}>{day(book.voucherDate)}</span>
          {/* Cut from the front when too long: the serial at the end is the part people read. */}
          <span className={styles.vno} title={book.voucherNumber}>
            <span dir="ltr">{book.voucherNumber || '—'}</span>
          </span>
        </td>
        <td className={cn(cell, styles.text)} onClick={onClick}>
          <span className={styles.party} title={book.particulars}>
            {book.particulars || book.narration || '—'}
          </span>
          {detail && (
            <span className={styles.sub} title={detail}>
              {detail}
            </span>
          )}
          {inList && <span className={styles.inlineBadge}>{statusBadge(row.status)}</span>}
        </td>
        <td className={cn(cell, styles.num)} onClick={onClick}>
          {paise(book.debit) ? money(book.debit) : ''}
        </td>
        <td className={cn(cell, styles.num)} onClick={onClick}>
          {paise(book.credit) ? money(book.credit) : ''}
        </td>
      </>
    );
  };

  const bankCells = (row: BoardRow, inList: boolean) => {
    const { line } = row;
    if (!line) {
      return (
        <td colSpan={4} className={cn(styles.k, styles.gap)}>
          {inList ? '' : hasStatement ? 'Not on the statement' : 'No statement uploaded'}
        </td>
      );
    }
    const focused = focus?.key === row.key;
    const pickable = row.status === 'bank-only';
    const cell = cn(styles.k, focused && styles.focused, row.status === 'ignored' && styles.struck);
    const onClick = inList ? () => setFocus({ key: row.key, side: 'bank' }) : undefined;
    return (
      <>
        <td className={cn(cell, styles.pick)} data-side="bank" data-key={row.key}>
          {pickable && (
            <input
              type="checkbox"
              className={styles.check}
              aria-label={`Pick bank line ${line.description} to match by hand`}
              checked={pickedLine === line.id}
              onChange={(event) => setPickedLine(event.target.checked ? line.id : null)}
            />
          )}
        </td>
        <td className={cn(cell, styles.text)} onClick={onClick}>
          <span className={styles.date}>{day(line.txnDate)}</span>
          <span className={styles.desc} title={line.description}>
            {line.description || '—'}
          </span>
          {line.reference && <span className={cn(styles.sub, styles.mono)}>Ref {line.reference}</span>}
          {inList && <span className={styles.inlineBadge}>{statusBadge(row.status)}</span>}
        </td>
        <td className={cn(cell, styles.num)} onClick={onClick}>
          {isDeposit(line) ? '' : money(line.withdrawal)}
        </td>
        <td
          className={cn(cell, styles.num, styles.edgeRight)}
          data-status={row.status}
          onClick={onClick}
        >
          {isDeposit(line) ? money(line.deposit) : ''}
        </td>
      </>
    );
  };

  /** What a row needs, in the lane between the two sides. */
  const lane = (row: BoardRow): ReactNode => {
    const { book, line } = row;
    switch (row.status) {
      case 'matched':
        return (
          <>
            {statusBadge('matched')}
            <span className={styles.note}>
              {book && line
                ? describeGap(book.voucherDate, line.txnDate)
                : book?.reconciledOn
                  ? `Ticked off by hand · ${day(book.reconciledOn)}`
                  : (line?.matchNote ?? '')}
            </span>
            {line && (
              <button
                type="button"
                className={styles.link}
                disabled={busy}
                title="Removes the bank date from the book line and opens both again"
                onClick={() => void act(() => undoStatementLine(companyId, ledgerId, line.id))}
              >
                Undo
              </button>
            )}
          </>
        );

      case 'suggested':
        return (
          <>
            {statusBadge('suggested')}
            <span className={styles.note}>{line?.matchNote ?? 'Same amount'}</span>
            {line && (
              <span className={styles.laneRow}>
                <Button
                  variant="secondary"
                  className={styles.small}
                  disabled={busy}
                  onClick={() =>
                    void act(async () =>
                      summarise(
                        await confirmStatementMatches(companyId, ledgerId, [line.id]),
                        'confirmed',
                      ),
                    )
                  }
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  className={styles.small}
                  disabled={busy}
                  title="Not the same money — open both again"
                  onClick={() =>
                    void act(() => undoStatementLine(companyId, ledgerId, line.id), false)
                  }
                >
                  Not this
                </Button>
              </span>
            )}
          </>
        );

      case 'draft':
        return (
          <>
            {statusBadge('draft')}
            <span className={styles.note}>
              Check it in <Link to={`/companies/${companyId}/vouchers?status=DRAFT`}>vouchers</Link>,
              then post
            </span>
            {line && (
              <span className={styles.laneRow}>
                <Button
                  variant="secondary"
                  className={styles.small}
                  disabled={busy}
                  onClick={() =>
                    void act(async () =>
                      summarise(
                        await postStatementVouchers(companyId, ledgerId, [line.id]),
                        'posted',
                      ),
                    )
                  }
                >
                  Post
                </Button>
                <Button
                  variant="ghost"
                  className={styles.small}
                  disabled={busy}
                  title="Deletes the draft and opens the bank line again"
                  onClick={() =>
                    void act(() => undoStatementLine(companyId, ledgerId, line.id), false)
                  }
                >
                  Delete
                </Button>
              </span>
            )}
          </>
        );

      case 'books-only':
        return (
          <>
            <span
              className={styles.badge}
              data-status="books-only"
              title={
                book && paise(book.credit) > 0
                  ? 'Paid out in the books, not yet shown by the bank'
                  : 'Received in the books, not yet credited by the bank'
              }
            >
              {STATUS_LABEL['books-only']}
            </span>
            {book && (
              <label className={styles.dateField}>
                <span>Bank date, if cleared</span>
                {/*
                  The day the bank showed it, typed by hand — for a bank whose statement is not
                  uploaded. The line leaves the open list the moment it has a date.
                */}
                <input
                  type="date"
                  className={styles.dateInput}
                  aria-label={`Bank date for ${book.voucherNumber}`}
                  disabled={busy}
                  defaultValue=""
                  onChange={(event) => {
                    const date = event.target.value;
                    if (!date) return;
                    void act(async () => {
                      await reconcileEntry(companyId, book.voucherId, book.entryId, date);
                      toast.success(`${book.voucherNumber} ticked off on ${day(date)}`);
                    });
                  }}
                />
              </label>
            )}
          </>
        );

      case 'bank-only': {
        if (!line) return null;
        const options = line.candidates ?? [];
        return (
          <>
            {statusBadge('bank-only')}
            {options.length > 0 && (
              <span className={styles.laneRow}>
                <Select
                  aria-label={`Possible book entry for ${line.description}`}
                  className={styles.laneSelect}
                  value={candidate[line.id] ?? ''}
                  onChange={(event) => setCandidate({ ...candidate, [line.id]: event.target.value })}
                >
                  <option value="">
                    {options.length} possible match{options.length === 1 ? '' : 'es'}…
                  </option>
                  {options.map((option) => (
                    <option key={option.entryId} value={option.entryId}>
                      {option.voucherNumber} · {day(option.voucherDate)}
                      {option.referenceMatch ? ' · same ref' : ''}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  className={styles.small}
                  disabled={busy || !candidate[line.id]}
                  onClick={() =>
                    void act(() =>
                      matchStatementLine(companyId, ledgerId, line.id, candidate[line.id]),
                    )
                  }
                >
                  Match
                </Button>
              </span>
            )}
            <Select
              aria-label={`Ledger for a voucher for ${line.description}`}
              className={cn(
                styles.laneSelect,
                line.suggestedLedgerId &&
                  contra[line.id] === line.suggestedLedgerId &&
                  styles.suggestedPick,
              )}
              value={contra[line.id] ?? ''}
              onChange={(event) => setContra({ ...contra, [line.id]: event.target.value })}
            >
              <option value="">Post to ledger…</option>
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.name}
                </option>
              ))}
            </Select>
            <span className={styles.laneRow}>
              <Button
                variant="secondary"
                className={styles.small}
                disabled={busy || !contra[line.id]}
                title="Raises a draft voucher. Nothing changes in the books until it is posted."
                onClick={() =>
                  void act(async () => {
                    summarise(
                      await createStatementVouchers(companyId, ledgerId, [
                        { lineId: line.id, contraLedgerId: contra[line.id] },
                      ]),
                      'raised as a draft',
                    );
                  }, false)
                }
              >
                Create {isDeposit(line) ? 'receipt' : 'payment'}
              </Button>
              <Button
                variant="ghost"
                className={styles.small}
                disabled={busy}
                onClick={() => void act(() => ignoreStatementLine(companyId, ledgerId, line.id), false)}
              >
                Ignore
              </Button>
            </span>
          </>
        );
      }

      case 'ignored':
        return (
          <>
            {statusBadge('ignored')}
            {line && (
              <button
                type="button"
                className={styles.link}
                disabled={busy}
                onClick={() => void act(() => undoStatementLine(companyId, ledgerId, line.id), false)}
              >
                Bring back
              </button>
            )}
          </>
        );
    }
  };

  /* ---------- rows, in either layout ---------- */

  let body: ReactNode;
  if (shown.length === 0) {
    body = (
      <tr>
        <td colSpan={10} className={styles.emptyRow}>
          {rows.length === 0
            ? `Nothing to reconcile up to ${day(asOf)}.`
            : 'Nothing here for this filter.'}
        </td>
      </tr>
    );
  } else if (layout === 'pair') {
    body = shown.map((row) => (
      <tr
        key={row.key}
        className={cn(
          row.book && pickedEntry === row.book.entryId && styles.pickedBook,
          row.line && pickedLine === row.line.id && styles.pickedBank,
        )}
      >
        {bookCells(row, false)}
        <td className={styles.lane}>
          <div className={styles.laneBox}>{lane(row)}</div>
        </td>
        {bankCells(row, false)}
      </tr>
    ));
  } else {
    // Each side in its own date order; a row holds two unrelated lines.
    const left = shown
      .filter((row) => row.book)
      .sort((a, b) => (dayOf(a.book!.voucherDate) < dayOf(b.book!.voucherDate) ? -1 : 1));
    const right = shown
      .filter((row) => row.line)
      .sort((a, b) => (dayOf(a.line!.txnDate) < dayOf(b.line!.txnDate) ? -1 : 1));
    body = Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
      const l = left[index];
      const r = right[index];
      return (
        <tr
          key={`${l?.key ?? '-'}|${r?.key ?? '-'}`}
          className={cn(
            l?.book && pickedEntry === l.book.entryId && styles.pickedBook,
            r?.line && pickedLine === r.line.id && styles.pickedBank,
          )}
        >
          {l ? bookCells(l, true) : <td colSpan={5} className={cn(styles.b, styles.blank)} />}
          <td className={cn(styles.lane, styles.laneThin)} />
          {r ? bankCells(r, true) : <td colSpan={4} className={cn(styles.k, styles.blank)} />}
        </tr>
      );
    });
  }

  const postedBooks = workspace.bookLines.filter((book) => book.voucherStatus === 'POSTED');
  const latest = workspace.statements[0];

  return (
    <section className={styles.board}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Reconcile with the bank statement</h2>
          <p className={styles.muted}>
            {hasStatement
              ? `${workspace.lines.length} bank line${workspace.lines.length === 1 ? '' : 's'} from ${workspace.statements.length} upload${workspace.statements.length === 1 ? '' : 's'}. Showing what is open up to ${day(asOf)}, and what was settled from ${day(from)}.`
              : 'Upload the statement the bank sent, and its lines are set against the books here. Without one, type the date the bank showed each entry.'}
          </p>
        </div>
        <div className={styles.headActions}>
          {hasStatement && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const found = await rerunStatementMatch(companyId, ledgerId);
                  toast.info(
                    found === 0
                      ? 'No new matches found'
                      : `${found} new match${found === 1 ? '' : 'es'} to confirm`,
                  );
                }, false)
              }
            >
              Match again
            </Button>
          )}
          {actions}
        </div>
      </header>

      <div className={styles.summary}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Balance as per books</span>
          <span className={styles.tileValue}>
            {amount(gap.books)}{' '}
            <small className={styles.side}>{gap.books >= 0 ? 'Dr' : 'Cr'}</small>
          </span>
          <span className={styles.tileSub}>as on {day(asOf)}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Balance as per bank</span>
          <span className={styles.tileValue}>
            {bankBalance ? signed(bankBalance.amount) : '—'}
          </span>
          <span className={styles.tileSub}>
            {bankBalance
              ? `on the statement, ${day(bankBalance.date)}`
              : hasStatement
                ? 'the statement shows no balance'
                : 'no statement uploaded'}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Gap to explain</span>
          <span className={styles.tileValue}>
            {bankBalance ? signed(bankBalance.amount - gap.books) : '—'}
          </span>
          <span className={styles.tileSub}>
            {unexplained === null ? (
              'needs the bank’s balance'
            ) : unexplained === 0 ? (
              <span className={styles.good}>✓ Fully explained below</span>
            ) : (
              <span className={styles.bad}>{signed(unexplained)} not explained</span>
            )}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Bank lines ticked off</span>
          <span className={styles.tileValue}>
            {bankLinesTicked} <small className={styles.side}>of {bankLinesInPeriod}</small>
          </span>
          <span className={styles.progress} aria-hidden>
            <i
              className={styles.progressDone}
              style={{ width: `${bankLinesInPeriod ? (bankLinesTicked / bankLinesInPeriod) * 100 : 0}%` }}
            />
            <i
              className={styles.progressWaiting}
              style={{ width: `${bankLinesInPeriod ? (counts.suggested / bankLinesInPeriod) * 100 : 0}%` }}
            />
          </span>
          <span className={styles.tileSub}>{counts.suggested} waiting for you to confirm</span>
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label="Show rows">
          {FILTERS.filter(
            (item) =>
              item.id === 'all' ||
              filter === item.id ||
              (item.id !== 'draft' && item.id !== 'ignored') ||
              counts[item.id] > 0,
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.chip}
              aria-pressed={filter === item.id}
              data-status={item.id === 'all' ? undefined : item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.id !== 'all' && <span className={styles.dot} />}
              {item.label}
              <span className={styles.count}>
                {item.id === 'all' ? rows.length : counts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search party, ref, amount…"
            aria-label="Search the books and the statement"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.segment} role="group" aria-label="Layout">
            <button
              type="button"
              aria-pressed={layout === 'pair'}
              title="Matched lines sit on the same row"
              onClick={() => chooseLayout('pair')}
            >
              Line up matches
            </button>
            <button
              type="button"
              aria-pressed={layout === 'list'}
              title="Each side in its own date order. Click a line to find its partner."
              onClick={() => chooseLayout('list')}
            >
              Two separate lists
            </button>
          </div>
        </div>
      </div>

      {(counts.suggested > 0 || readyDrafts.length > 0 || counts.draft > 0) && (
        <div className={styles.bulk}>
          {counts.suggested > 0 && (
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () =>
                  summarise(await confirmStatementMatches(companyId, ledgerId), 'confirmed'),
                )
              }
            >
              Confirm all {counts.suggested} suggested
            </Button>
          )}
          {readyDrafts.length > 0 && (
            <Button
              variant="secondary"
              disabled={busy}
              title="Raises a draft voucher for every bank line with a ledger chosen. Nothing is posted."
              onClick={() =>
                void act(async () =>
                  summarise(
                    await createStatementVouchers(
                      companyId,
                      ledgerId,
                      readyDrafts.map((row) => ({
                        lineId: row.line!.id,
                        contraLedgerId: contra[row.line!.id],
                      })),
                    ),
                    'raised as drafts',
                  ),
                  false,
                )
              }
            >
              Create {readyDrafts.length} draft voucher{readyDrafts.length === 1 ? '' : 's'}
            </Button>
          )}
          {counts.draft > 0 && (
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmPost(true)}>
              Post all {counts.draft} draft{counts.draft === 1 ? '' : 's'}
            </Button>
          )}
          {layout === 'list' && (
            <span className={styles.muted}>Switch to “Line up matches” to act on one row.</span>
          )}
        </div>
      )}

      <div className={styles.frame}>
        <div className={styles.scroller} ref={scroller}>
          <table className={styles.grid}>
            <colgroup>
              <col className={styles.colPick} />
              <col className={styles.colVoucher} />
              <col />
              <col className={styles.colAmount} />
              <col className={styles.colAmount} />
              <col className={layout === 'pair' ? styles.colLane : styles.colLaneThin} />
              <col className={styles.colPick} />
              <col />
              <col className={styles.colAmount} />
              <col className={styles.colAmount} />
            </colgroup>
            <thead>
              <tr className={styles.sideHeads}>
                <th colSpan={5} className={styles.b}>
                  <span className={styles.sideTag}>In books</span> {ledgerName}
                  <small className={styles.sideMeta}>
                    {postedBooks.filter((book) => !book.reconciledOn).length} open
                  </small>
                </th>
                <th className={styles.lane} />
                <th colSpan={4} className={styles.k}>
                  <span className={styles.sideTag}>Bank statement</span>{' '}
                  {latest ? latest.fileName : 'Not uploaded'}
                  {latest?.fromDate && latest.toDate && (
                    <small className={styles.sideMeta}>
                      {day(latest.fromDate)} – {day(latest.toDate)}
                    </small>
                  )}
                </th>
              </tr>
              <tr className={styles.colHeads}>
                <th className={styles.b} aria-label="Pick" />
                <th className={styles.b}>Date · Voucher</th>
                <th className={styles.b}>Particulars</th>
                <th className={cn(styles.b, styles.num)}>
                  Debit <span className={styles.in}>in</span>
                </th>
                <th className={cn(styles.b, styles.num)}>
                  Credit <span className={styles.out}>out</span>
                </th>
                <th className={styles.lane} />
                <th className={styles.k} aria-label="Pick" />
                <th className={styles.k}>Date · Description</th>
                <th className={cn(styles.k, styles.num)}>
                  Withdrawal <span className={styles.out}>out</span>
                </th>
                <th className={cn(styles.k, styles.num)}>
                  Deposit <span className={styles.in}>in</span>
                </th>
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>

        {(pickBook || pickLine) && (
          <div className={styles.pickBar} role="status">
            <span className={styles.pickGroup}>
              <span>Books</span>
              <b>
                {pickBook
                  ? `${pickBook.voucherNumber} · ${paise(pickBook.debit) ? `${money(pickBook.debit)} Dr` : `${money(pickBook.credit)} Cr`}`
                  : 'Tick an entry on the left'}
              </b>
            </span>
            <span className={styles.pickGroup}>
              <span>Bank</span>
              <b>
                {pickLine
                  ? `${day(pickLine.txnDate)} · ${isDeposit(pickLine) ? `${money(pickLine.deposit)} in` : `${money(pickLine.withdrawal)} out`}`
                  : 'Tick a line on the right'}
              </b>
            </span>
            {pickBook && pickLine && (
              <span className={cn(styles.pickGroup, pickFits ? styles.good : styles.bad)}>
                <span>Check</span>
                <b>{pickFits ? '✓ Same money' : 'Amount or side differs'}</b>
              </span>
            )}
            <span className={styles.spacer} />
            <Button
              variant="ghost"
              onClick={() => {
                setPickedEntry(null);
                setPickedLine(null);
              }}
            >
              Clear
            </Button>
            <Button
              disabled={busy || !pickFits}
              onClick={() =>
                void act(async () => {
                  await matchStatementLine(companyId, ledgerId, pickLine!.id, pickBook!.entryId);
                  toast.success(`${pickBook!.voucherNumber} matched with the bank line`);
                })
              }
            >
              Match these two
            </Button>
          </div>
        )}
      </div>

      <div className={styles.bridge}>
        <h3 className={styles.bridgeTitle}>Why the two balances differ</h3>
        <p className={styles.muted}>
          Every line not yet matched explains part of the gap. When the last line agrees with the
          statement, the account is reconciled.
        </p>
        <table className={styles.bridgeTable}>
          <tbody>
            <tr className={styles.bridgeStrong}>
              <td className={styles.op} />
              <td>Balance as per books</td>
              <td className={styles.num}>{signed(gap.books)}</td>
            </tr>
            <tr>
              <td className={styles.op}>+</td>
              <td>
                Paid out in the books, not yet shown by the bank{' '}
                <span className={styles.count}>({gap.notPresentedCount})</span>
              </td>
              <td className={styles.num}>{amount(gap.notPresented)}</td>
            </tr>
            <tr>
              <td className={styles.op}>−</td>
              <td>
                Received in the books, not yet credited by the bank{' '}
                <span className={styles.count}>({gap.notCreditedCount})</span>
              </td>
              <td className={styles.num}>{amount(gap.notCredited)}</td>
            </tr>
            <tr>
              <td className={styles.op}>+</td>
              <td>
                Credited by the bank, not posted in the books{' '}
                <span className={styles.count}>({gap.bankInCount})</span>
              </td>
              <td className={styles.num}>{amount(gap.bankIn)}</td>
            </tr>
            <tr>
              <td className={styles.op}>−</td>
              <td>
                Debited by the bank, not posted in the books{' '}
                <span className={styles.count}>({gap.bankOutCount})</span>
              </td>
              <td className={styles.num}>{amount(gap.bankOut)}</td>
            </tr>
            <tr className={styles.bridgeTotal}>
              <td className={styles.op}>=</td>
              <td>What the statement should show</td>
              <td className={styles.num}>{signed(gap.expected)}</td>
            </tr>
            <tr>
              <td className={styles.op} />
              <td>Balance on the statement</td>
              <td className={styles.num}>{bankBalance ? signed(bankBalance.amount) : '—'}</td>
            </tr>
            <tr className={styles.bridgeStrong}>
              <td className={styles.op} />
              <td>Difference</td>
              <td className={styles.num}>
                {unexplained === null ? (
                  '—'
                ) : unexplained === 0 ? (
                  <span className={styles.good}>✓ {amount(0)} · agrees</span>
                ) : (
                  <span className={styles.bad}>{signed(unexplained)}</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {unexplained !== null && unexplained !== 0 && (
          <p className={styles.muted}>
            Something is missing from one side. Common causes: a statement for an earlier month
            not uploaded, an entry ticked off by hand while its bank line stayed open, or a line
            marked “ignored” that the bank did take.
          </p>
        )}
      </div>

      {hasStatement && (
        <details className={styles.uploads}>
          <summary>Uploaded files ({workspace.statements.length})</summary>
          <ul>
            {workspace.statements.map((statement) => (
              <li key={statement.id}>
                <span>
                  <strong>{statement.fileName}</strong> · {statement.format.replace('_', ' ')}
                  {statement.fromDate && statement.toDate
                    ? ` · ${day(statement.fromDate)} – ${day(statement.toDate)}`
                    : ''}{' '}
                  · {statement.lineCount} line{statement.lineCount === 1 ? '' : 's'}
                  {statement.closingBalance !== undefined && statement.closingBalance !== null
                    ? ` · closing ${money(statement.closingBalance)}`
                    : ''}
                </span>
                <Button variant="ghost" disabled={busy} onClick={() => setRemoving(statement)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmDialog
        open={confirmPost}
        title={`Post ${counts.draft} draft voucher${counts.draft === 1 ? '' : 's'}?`}
        consequence="Posted vouchers go into the books and every report. Post only once each draft's ledger is right."
        confirmLabel="Post vouchers"
        busy={busy}
        onCancel={() => setConfirmPost(false)}
        onConfirm={() => {
          setConfirmPost(false);
          void act(async () =>
            summarise(await postStatementVouchers(companyId, ledgerId), 'posted'),
          );
        }}
      >
        Each one is ticked off against the statement with the bank&rsquo;s date as it is posted.
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove “${removing?.fileName ?? ''}”?`}
        consequence="Its lines leave this screen. Lines already ticked off in the books stay ticked off, and drafts raised from it stay as drafts."
        confirmLabel="Remove upload"
        destructive
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) void act(() => deleteStatement(companyId, ledgerId, target.id), false);
        }}
      />
    </section>
  );
}
