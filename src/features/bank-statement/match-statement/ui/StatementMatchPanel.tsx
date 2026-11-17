import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  type StatementLine,
  type StatementLineStatus,
  type StatementSummary,
  type StatementWorkspace,
} from '@/entities/bank-statement';
import { cn, getErrorMessage } from '@/shared/lib';
import { Button, ConfirmDialog, Select, Table, Tabs, toast } from '@/shared/ui';

import styles from './StatementMatchPanel.module.css';

export interface LedgerOption {
  id: string;
  name: string;
}

interface StatementMatchPanelProps {
  companyId: string;
  ledgerId: string;
  /** Every active ledger a voucher's other side could be, this bank account left out. */
  ledgers: LedgerOption[];
  money: (value: string) => string;
  day: (value: string) => string;
  /** Changes whenever the caller wants the panel to read again — after an upload, say. */
  refreshKey: number;
  /** Buttons for the panel's header, such as the upload button the page owns. */
  actions?: ReactNode;
  /** The workspace as last read, for the caller to take the saved column mapping from. */
  onLoaded?: (workspace: StatementWorkspace) => void;
  /** The books' reconciliation marks moved; the statement above should be read again. */
  onBooksChanged: () => void;
}

type TabId = StatementLineStatus;

const TAB_LABELS: Record<TabId, string> = {
  SUGGESTED: 'To confirm',
  UNMATCHED: 'Not in books',
  VOUCHER_CREATED: 'Drafts raised',
  MATCHED: 'Matched',
  IGNORED: 'Ignored',
};
const TAB_ORDER: TabId[] = ['SUGGESTED', 'UNMATCHED', 'VOUCHER_CREATED', 'MATCHED', 'IGNORED'];

const isDeposit = (line: StatementLine) => Number(line.deposit) > 0;

function describeDays(days: number): string {
  if (days === 0) return 'same day';
  const count = Math.abs(days);
  return `${count} day${count === 1 ? '' : 's'} ${days > 0 ? 'before the bank' : 'after the bank'}`;
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

/**
 * The uploaded statement set against the books, one bank line at a time.
 *
 * Each tab is a decision still to make, in the order they are best made in:
 *
 * 1. **To confirm** — the matcher found the book line; confirm and it is ticked off with the bank's
 *    date. Nothing is ticked off without this step.
 * 2. **Not in books** — pick a possible match if one is offered; otherwise choose the other ledger
 *    (a suggestion is filled in) and raise a draft voucher. A bank charge, interest, a customer's
 *    direct transfer: the bank knows about it, the books do not yet.
 * 3. **Drafts raised** — look the drafts over, then post them. Posting ticks them off on its own.
 */
export function StatementMatchPanel({
  companyId,
  ledgerId,
  ledgers,
  money,
  day,
  refreshKey,
  actions,
  onLoaded,
  onBooksChanged,
}: StatementMatchPanelProps) {
  const [workspace, setWorkspace] = useState<StatementWorkspace | null>(null);
  const [tab, setTab] = useState<TabId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contra, setContra] = useState<Record<string, string>>({});
  const [candidate, setCandidate] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmPost, setConfirmPost] = useState(false);
  const [removing, setRemoving] = useState<StatementSummary | null>(null);

  /**
   * Takes a freshly read workspace in: the lines, the tab to show, the suggested ledgers.
   *
   * `fresh` is a new reading of the statement — the panel opening, or a file just uploaded —
   * rather than the result of an action taken in it. A fresh reading opens on the first tab with
   * something to do (after an upload, "To confirm") and ticks every open line that already has a
   * ledger suggested, so raising their drafts is one click. After an action, the person stays
   * where they were, with whatever they ticked or unticked.
   */
  const apply = useCallback(
    (next: StatementWorkspace, fresh = false) => {
      setWorkspace(next);
      onLoaded?.(next);
      setError(null);
      const firstWithWork = TAB_ORDER.find((id) => next.counts[id] > 0) ?? 'UNMATCHED';
      setTab((current) =>
        !fresh && current && next.counts[current] > 0 ? current : firstWithWork,
      );
      const open = new Set(
        next.lines.filter((line) => line.status === 'UNMATCHED').map((line) => line.id),
      );
      setSelected((current) => {
        const kept = new Set([...current].filter((id) => open.has(id)));
        if (fresh) {
          for (const line of next.lines) {
            if (open.has(line.id) && line.suggestedLedgerId) kept.add(line.id);
          }
        }
        return kept;
      });
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
        if (!cancelled) apply(next, true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, 'The statement could not be loaded'));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, ledgerId, apply, refreshKey]);

  /** Runs an action, then reads both the panel and the reconciliation above it again. */
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

  if (!workspace) {
    return (
      <section className={styles.panel}>
        <header className={styles.head}>
          <h2 className={styles.title}>Bank statement</h2>
          <div className={styles.headActions}>{actions}</div>
        </header>
        {error ? <p className={styles.error}>{error}</p> : <p className={styles.muted}>Loading…</p>}
      </section>
    );
  }

  const lines = workspace.lines.filter((line) => line.status === tab);
  const openLines = workspace.lines.filter((line) => line.status === 'UNMATCHED');
  const selectedReady = [...selected].filter(
    (id) => openLines.some((line) => line.id === id) && contra[id],
  );

  const amountCells = (line: StatementLine) => (
    <>
      <td data-num className={styles.out}>
        {isDeposit(line) ? '' : money(line.withdrawal)}
      </td>
      <td data-num className={styles.in}>
        {isDeposit(line) ? money(line.deposit) : ''}
      </td>
    </>
  );

  const bankCells = (line: StatementLine) => (
    <>
      <td className={styles.nowrap}>{day(line.txnDate)}</td>
      <td className={styles.description}>
        {line.description || '—'}
        {line.reference && <span className={styles.reference}>Ref {line.reference}</span>}
      </td>
      {amountCells(line)}
    </>
  );

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Bank statement</h2>
          <p className={styles.muted}>
            {workspace.statements.length === 0
              ? 'Upload the statement the bank sent, and its lines are matched with the books here.'
              : `${workspace.lines.length} line${workspace.lines.length === 1 ? '' : 's'} from ${workspace.statements.length} upload${workspace.statements.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className={styles.headActions}>
          {workspace.statements.length > 0 && (
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

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {workspace.statements.length > 0 && tab && (
        <>
          <Tabs<TabId>
            label="Statement lines"
            value={tab}
            onChange={setTab}
            items={TAB_ORDER.map((id) => ({
              id,
              label: `${TAB_LABELS[id]} (${workspace.counts[id]})`,
            }))}
          />

          {tab === 'SUGGESTED' && lines.length > 0 && (
            <div className={styles.bar}>
              <p className={styles.muted}>
                Each bank line below has one book line with the same amount. Confirm, and the book
                line is marked with the bank&rsquo;s date.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    summarise(await confirmStatementMatches(companyId, ledgerId), 'confirmed'),
                  )
                }
              >
                Confirm all {lines.length}
              </Button>
            </div>
          )}

          {tab === 'UNMATCHED' && lines.length > 0 && (
            <div className={styles.bar}>
              <p className={styles.muted}>
                The bank shows these, the books do not. If a possible match is offered, check and
                use it. Otherwise choose the other ledger and raise a <strong>draft</strong> voucher
                — a deposit becomes a receipt, a withdrawal a payment. Drafts change nothing until
                they are checked and posted.
              </p>
              <Button
                disabled={busy || selectedReady.length === 0}
                onClick={() =>
                  void act(async () => {
                    const result = await createStatementVouchers(
                      companyId,
                      ledgerId,
                      selectedReady.map((lineId) => ({ lineId, contraLedgerId: contra[lineId] })),
                    );
                    summarise(result, 'raised as drafts');
                    setSelected(new Set());
                  }, false)
                }
              >
                Raise {selectedReady.length || ''} draft voucher
                {selectedReady.length === 1 ? '' : 's'}
              </Button>
            </div>
          )}

          {tab === 'VOUCHER_CREATED' && lines.length > 0 && (
            <div className={styles.bar}>
              <p className={styles.muted}>
                Check each draft — the party, the bill it settles, any GST — in{' '}
                <Link to={`/companies/${companyId}/vouchers?status=DRAFT`}>the vouchers list</Link>.
                Posting puts it in the books and ticks it off against this statement.
              </p>
              <Button disabled={busy} onClick={() => setConfirmPost(true)}>
                Post all {lines.length}
              </Button>
            </div>
          )}

          {lines.length === 0 ? (
            <p className={styles.empty}>
              {tab === 'SUGGESTED' && 'No matches waiting to be confirmed.'}
              {tab === 'UNMATCHED' && 'Every bank line is accounted for in the books.'}
              {tab === 'VOUCHER_CREATED' && 'No drafts waiting to be posted.'}
              {tab === 'MATCHED' && 'Nothing matched yet.'}
              {tab === 'IGNORED' && 'Nothing ignored.'}
            </p>
          ) : (
            <Table surface="plain" density="tight" sticky className={styles.table} stack>
              <thead>
                <tr>
                  {tab === 'UNMATCHED' && (
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select every line"
                        checked={lines.length > 0 && lines.every((line) => selected.has(line.id))}
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? new Set(lines.map((line) => line.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                  )}
                  <th>Bank date</th>
                  <th>Description</th>
                  <th data-num>Withdrawal</th>
                  <th data-num>Deposit</th>
                  {tab === 'UNMATCHED' ? (
                    <>
                      <th>What to do</th>
                    </>
                  ) : (
                    <th>In the books</th>
                  )}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    {tab === 'UNMATCHED' && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${line.description}`}
                          checked={selected.has(line.id)}
                          onChange={(event) => {
                            const next = new Set(selected);
                            if (event.target.checked) next.add(line.id);
                            else next.delete(line.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                    )}
                    {bankCells(line)}

                    {tab === 'UNMATCHED' ? (
                      <>
                        <td>
                          <div className={styles.action}>
                            {line.candidates && line.candidates.length > 0 && (
                              <div className={styles.inline}>
                                <Select
                                  aria-label="Possible match"
                                  className={styles.select}
                                  value={candidate[line.id] ?? ''}
                                  onChange={(event) =>
                                    setCandidate({ ...candidate, [line.id]: event.target.value })
                                  }
                                >
                                  <option value="">
                                    {line.candidates.length} possible — choose…
                                  </option>
                                  {line.candidates.map((option) => (
                                    <option key={option.entryId} value={option.entryId}>
                                      {option.voucherNumber} · {day(option.voucherDate)} ·{' '}
                                      {option.referenceMatch ? 'same ref · ' : ''}
                                      {describeDays(option.daysApart)}
                                      {option.narration
                                        ? ` · ${option.narration.slice(0, 30)}`
                                        : ''}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  variant="secondary"
                                  disabled={busy || !candidate[line.id]}
                                  onClick={() =>
                                    void act(() =>
                                      matchStatementLine(
                                        companyId,
                                        ledgerId,
                                        line.id,
                                        candidate[line.id],
                                      ),
                                    )
                                  }
                                >
                                  Match
                                </Button>
                              </div>
                            )}
                            <span className={styles.hint}>
                              {line.candidates && line.candidates.length > 0
                                ? 'or, if none of those, raise a draft to'
                                : 'Not in the books. Raise a draft to'}
                            </span>
                            <Select
                              aria-label="Other ledger"
                              className={cn(
                                styles.select,
                                line.suggestedLedgerId &&
                                  contra[line.id] === line.suggestedLedgerId &&
                                  styles.suggested,
                              )}
                              value={contra[line.id] ?? ''}
                              onChange={(event) => {
                                setContra({ ...contra, [line.id]: event.target.value });
                                if (event.target.value) setSelected(new Set(selected).add(line.id));
                              }}
                            >
                              <option value="">Choose a ledger…</option>
                              {ledgers.map((ledger) => (
                                <option key={ledger.id} value={ledger.id}>
                                  {ledger.name}
                                </option>
                              ))}
                            </Select>
                            {line.suggestedLedgerId &&
                              contra[line.id] === line.suggestedLedgerId && (
                                <span className={styles.hint}>
                                  Suggested · {isDeposit(line) ? 'Receipt' : 'Payment'}
                                </span>
                              )}
                          </div>
                        </td>
                        <td className={styles.rowActions}>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => ignoreStatementLine(companyId, ledgerId, line.id),
                                false,
                              )
                            }
                          >
                            Ignore
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {line.voucher ? (
                            <>
                              <span className={styles.voucher}>{line.voucher.voucherNumber}</span>
                              <span className={styles.hint}>
                                {day(line.voucher.voucherDate)}
                                {line.voucher.status === 'DRAFT' ? ' · draft' : ''}
                                {line.matchNote ? ` · ${line.matchNote}` : ''}
                              </span>
                            </>
                          ) : (
                            <span className={styles.muted}>{line.matchNote ?? '—'}</span>
                          )}
                        </td>
                        <td className={styles.rowActions}>
                          {tab === 'SUGGESTED' && (
                            <Button
                              variant="secondary"
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
                          )}
                          <Button
                            variant="ghost"
                            disabled={busy}
                            title={
                              tab === 'VOUCHER_CREATED'
                                ? 'Deletes the draft and opens the line again'
                                : tab === 'MATCHED'
                                  ? 'Removes the bank date from the book line and opens the line again'
                                  : 'Opens the line again'
                            }
                            onClick={() =>
                              void act(
                                () => undoStatementLine(companyId, ledgerId, line.id),
                                tab === 'MATCHED',
                              )
                            }
                          >
                            {tab === 'SUGGESTED' ? 'Not this' : 'Undo'}
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <details className={styles.uploads}>
            <summary>Uploaded files ({workspace.statements.length})</summary>
            <ul>
              {workspace.statements.map((statement) => (
                <li key={statement.id}>
                  <span>
                    <strong>{statement.fileName}</strong> · {statement.format.replace('_', ' ')} ·{' '}
                    {statement.fromDate && statement.toDate
                      ? `${day(statement.fromDate)} – ${day(statement.toDate)}`
                      : ''}{' '}
                    · {statement.lineCount} line{statement.lineCount === 1 ? '' : 's'}
                    {statement.closingBalance !== undefined
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
        </>
      )}

      <ConfirmDialog
        open={confirmPost}
        title={`Post ${workspace.counts.VOUCHER_CREATED} draft voucher${workspace.counts.VOUCHER_CREATED === 1 ? '' : 's'}?`}
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
        Each one is ticked off against this statement with the bank&rsquo;s date as it is posted.
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove “${removing?.fileName ?? ''}”?`}
        consequence="Its lines leave this panel. Lines already ticked off in the books stay ticked off, and drafts raised from it stay as drafts."
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
