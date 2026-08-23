import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';

import { createAccountGroup, updateAccountGroup } from '@/entities/account-group';
import type { AccountGroup, AccountNature, GroupType } from '@/entities/account-group';
import { createLedger, updateLedger } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import { Button } from '@/shared/ui';
import { downloadCsv, getErrorMessage, parseCsv } from '@/shared/lib';

import styles from './ImportExportPanel.module.css';

interface ImportExportPanelProps {
  companyId: string;
  companyCode: string;
  groups: AccountGroup[];
  ledgers: Ledger[];
  /** Ledgers created here are the same records the chart of accounts is showing. */
  onImported: () => void;
}

/**
 * The columns an import is read from, and an export is written in. One list, so they match.
 *
 * The party details are here because the round trip is the point: a chart exported without them
 * cannot be used to correct them in bulk, which is the one job a spreadsheet is better at than the
 * form. A file that omits the columns still imports — a column that is not there leaves the field
 * as it was, rather than clearing it.
 */
const LEDGER_COLUMNS = [
  'code',
  'name',
  'accountGroupCode',
  'ledgerType',
  'openingBalance',
  'openingBalanceType',
  'maintainBillwise',
  'gstin',
  'pan',
  'address',
  'contactEmail',
  'contactPhone',
] as const;

/**
 * The same for groups.
 *
 * `nature` is not decoration: creating a group requires it, and the export left it out — which
 * meant the file this screen produced was one the same screen could not read back.
 */
const GROUP_COLUMNS = ['code', 'name', 'parentCode', 'nature', 'groupType'] as const;

/** What became of one line of the file. */
interface RowOutcome {
  line: number;
  code: string;
  /** `null` when it worked; the reason it did not, otherwise. */
  error: string | null;
  created: boolean;
}

/**
 * How many rows are in flight at once.
 *
 * Each row is still its own request — they are validated independently and refused independently,
 * which is what lets a file of forty accounts leave thirty-eight behind — but sending them one
 * after another made a chart of two hundred a two hundred round-trip wait. Bounded rather than
 * unbounded: a browser will happily open a hundred sockets and a rate limiter will happily refuse
 * most of them, which would read as the file being wrong.
 */
const CONCURRENCY = 6;

/** Runs `work` over `items`, at most `limit` at a time, keeping results in the order given. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const runner = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

/**
 * Getting a chart of accounts in and out of a spreadsheet.
 *
 * Setting up a company by hand is dozens of forms, and every accountant already keeps their chart
 * in a spreadsheet — so the useful thing is not another form but a way to bring that file in. The
 * export exists mostly to make the import obvious: take the file out, edit it, put it back, and the
 * columns are self-evidently right because the product wrote them.
 *
 * Rows go in one at a time against the ordinary endpoints rather than through a bulk route, so
 * every row gets the same validation a typed one does. That makes a partial import possible, which
 * is why each row reports its own outcome — a file of forty accounts where two are rejected should
 * leave thirty-eight in place and say which two failed, not refuse the lot.
 *
 * A code that already exists is updated rather than refused. Refusing was defensible while the only
 * thing you could do was create, but it made the export useless for its most obvious purpose:
 * exporting the chart, correcting a column in a spreadsheet, and putting it back. Every row of such
 * a file is a duplicate.
 */
export function ImportExportPanel({
  companyId,
  companyCode,
  groups,
  ledgers,
  onImported,
}: ImportExportPanelProps) {
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupCodeById = new Map(groups.map((group) => [group.id, group.code]));

  function exportGroups() {
    downloadCsv(
      `${companyCode}-account-groups.csv`,
      [...GROUP_COLUMNS],
      groups.map((group) => [
        group.code,
        group.name,
        group.parentId ? (groupCodeById.get(group.parentId) ?? '') : '',
        group.nature,
        group.groupType,
      ]),
    );
  }

  function exportLedgers() {
    downloadCsv(
      `${companyCode}-ledgers.csv`,
      [...LEDGER_COLUMNS],
      ledgers.map((ledger) => [
        ledger.code,
        ledger.name,
        groupCodeById.get(ledger.accountGroupId) ?? '',
        ledger.ledgerType,
        ledger.openingBalance,
        ledger.openingBalanceType,
        String(ledger.maintainBillwise),
        ledger.gstin ?? '',
        ledger.pan ?? '',
        ledger.address ?? '',
        ledger.contactEmail ?? '',
        ledger.contactPhone ?? '',
      ]),
    );
  }

  /**
   * Reads the file and lines its header up with the columns expected.
   *
   * Returns a reader that answers by column name, so the rest of the import never counts commas.
   * A column that is absent reads as `undefined` rather than as an empty string — the difference
   * decides whether an update clears a field or leaves it alone.
   */
  async function readFile(file: File, columns: readonly string[], required: string[]) {
    const [header, ...body] = parseCsv(await file.text());
    if (!header) throw new Error('That file is empty.');

    const positions = new Map(
      columns.map((column) => [
        column,
        header.findIndex((cell) => cell.trim().toLowerCase() === column.toLowerCase()),
      ]),
    );

    const missing = required.filter((column) => (positions.get(column) ?? -1) === -1);
    if (missing.length > 0) {
      throw new Error(
        `That file has no ${missing.join(', ')} column. Export first and edit that file.`,
      );
    }

    const value = (row: string[], column: string) => {
      const position = positions.get(column) ?? -1;
      if (position === -1) return undefined;
      return (row[position] ?? '').trim();
    };

    // The header is line 1, so the first body row is line 2 — which is what a spreadsheet shows.
    const rows = body
      .map((row, offset) => ({ row, line: offset + 2, code: value(row, 'code') ?? '' }))
      .filter(({ code }) => code !== '');

    return { rows, value };
  }

  /** Only the fields the file actually carried, so an absent column leaves its field alone. */
  function present<T extends Record<string, unknown>>(fields: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }

  async function run(work: () => Promise<RowOutcome[]>) {
    setBusy(true);
    setError(null);
    setOutcomes(null);

    try {
      const results = await work();
      setOutcomes(results);
      if (results.some((result) => result.error === null)) onImported();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read that file'));
    } finally {
      setBusy(false);
    }
  }

  async function importLedgers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared straight away so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    await run(async () => {
      const { rows, value } = await readFile(file, LEDGER_COLUMNS, [
        'code',
        'name',
        'accountGroupCode',
      ]);
      const existing = new Map(ledgers.map((ledger) => [ledger.code, ledger]));

      /*
        Ledgers are independent of one another — each names a group that already exists — so they
        can go up together. Groups cannot, which is why only this side is parallel.
      */
      return mapWithLimit(rows, CONCURRENCY, async ({ line, code, row }) => {
        const at = (column: string) => value(row, column);
        const opening = at('openingBalance');
        const side = at('openingBalanceType');
        const billwise = at('maintainBillwise');

        const fields = present({
          name: at('name'),
          accountGroupCode: at('accountGroupCode'),
          ledgerType: at('ledgerType') as Ledger['ledgerType'] | undefined,
          openingBalance: opening === undefined || opening === '' ? undefined : Number(opening),
          openingBalanceType:
            side === undefined
              ? undefined
              : ((side.toUpperCase() === 'CREDIT'
                  ? 'CREDIT'
                  : 'DEBIT') as Ledger['openingBalanceType']),
          maintainBillwise: billwise === undefined ? undefined : billwise.toLowerCase() === 'true',
          gstin: at('gstin'),
          pan: at('pan'),
          address: at('address'),
          contactEmail: at('contactEmail'),
          contactPhone: at('contactPhone'),
        });

        const already = existing.get(code);

        try {
          if (already) {
            await updateLedger(companyId, already.id, fields);
            return { line, code, error: null, created: false };
          }

          await createLedger(companyId, {
            code,
            name: fields.name ?? '',
            accountGroupCode: fields.accountGroupCode ?? '',
            ledgerType: fields.ledgerType ?? 'GENERAL',
            ...fields,
          });
          return { line, code, error: null, created: true };
        } catch (err) {
          return { line, code, error: getErrorMessage(err, 'Refused'), created: false };
        }
      });
    });
  }

  async function importGroups(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    await run(async () => {
      const { rows, value } = await readFile(file, GROUP_COLUMNS, [
        'code',
        'name',
        'nature',
        'groupType',
      ]);
      const existing = new Map(groups.map((group) => [group.code, group.id]));

      /*
        A group names its parent, and a file may well carry both. Sent in the order written, a child
        that comes before its parent is refused for a parent that is about to exist — so the file is
        walked repeatedly, taking whichever rows can go next, until a pass achieves nothing. What is
        left after that genuinely has nowhere to hang: a missing parent, or a cycle.

        Sequential for the same reason: each pass depends on what the one before it created.
      */
      const results: RowOutcome[] = [];
      const known = new Set(existing.keys());
      let pending = rows;

      while (pending.length > 0) {
        const ready = pending.filter(({ row }) => {
          const parent = value(row, 'parentCode');
          return !parent || known.has(parent);
        });
        if (ready.length === 0) break;

        for (const { line, code, row } of ready) {
          const at = (column: string) => value(row, column);

          try {
            const already = existing.get(code);
            if (already) {
              // The API takes a name and an active flag; a group's nature and parent are fixed
              // once it holds postings, so a file cannot move it.
              await updateAccountGroup(companyId, already, present({ name: at('name') }));
              results.push({ line, code, error: null, created: false });
            } else {
              const created = await createAccountGroup(companyId, {
                code,
                name: at('name') ?? '',
                parentCode: at('parentCode') || undefined,
                nature: at('nature') as AccountNature,
                groupType: at('groupType') as GroupType,
              });
              existing.set(code, created.id);
              results.push({ line, code, error: null, created: true });
            }
            known.add(code);
          } catch (err) {
            results.push({ line, code, error: getErrorMessage(err, 'Refused'), created: false });
            // Marked known so its children are attempted and fail on their own terms, rather than
            // being reported as orphans because of a fault one row above them.
            known.add(code);
          }
        }

        const done = new Set(ready.map((item) => item.line));
        pending = pending.filter((item) => !done.has(item.line));
      }

      for (const { line, code } of pending) {
        results.push({
          line,
          code,
          error: 'Its parent is not in this file and does not exist yet.',
          created: false,
        });
      }

      return results.sort((a, b) => a.line - b.line);
    });
  }

  const created = outcomes?.filter((outcome) => outcome.error === null && outcome.created) ?? [];
  const updated = outcomes?.filter((outcome) => outcome.error === null && !outcome.created) ?? [];
  const refused = outcomes?.filter((outcome) => outcome.error !== null) ?? [];

  const tally = [
    created.length > 0 && `${created.length} created`,
    updated.length > 0 && `${updated.length} updated`,
  ].filter(Boolean);

  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <h2 className={styles.title}>Export</h2>
        <p className={styles.note}>
          The chart as it stands, in the columns an import reads back. Amounts are written exactly
          as they are held, so a figure does not change by going through a spreadsheet.
        </p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={exportGroups} disabled={groups.length === 0}>
            <Download size={14} /> Account groups ({groups.length})
          </Button>
          <Button variant="secondary" onClick={exportLedgers} disabled={ledgers.length === 0}>
            <Download size={14} /> Ledgers ({ledgers.length})
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>Import</h2>
        <p className={styles.note}>
          A code that is already in use is updated; anything else is created. A column the file does
          not carry is left as it was, so a file with three columns corrects three columns. Rows are
          independent — the ones that are accepted stay, and the ones that are not are listed below.
        </p>

        <div className={styles.actions}>
          <label className={styles.upload}>
            <input type="file" accept=".csv,text/csv" onChange={importGroups} disabled={busy} />
            <span className={styles.uploadFace}>
              <Upload size={14} /> {busy ? 'Reading…' : 'Account groups CSV'}
            </span>
          </label>

          <label className={styles.upload}>
            <input type="file" accept=".csv,text/csv" onChange={importLedgers} disabled={busy} />
            <span className={styles.uploadFace}>
              <Upload size={14} /> {busy ? 'Reading…' : 'Ledgers CSV'}
            </span>
          </label>
        </div>

        <p className={styles.note}>
          Groups need <code>code</code>, <code>name</code>, <code>nature</code> and{' '}
          <code>groupType</code>; ledgers need <code>code</code>, <code>name</code> and{' '}
          <code>accountGroupCode</code>. A group whose parent is further down the same file is still
          created — the file is walked until nothing more can be placed.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {outcomes && (
          <div className={styles.outcome} role="status">
            <p className={tally.length > 0 ? styles.created : styles.note}>
              {tally.length === 0 ? 'Nothing was changed.' : `${tally.join(', ')}.`}
            </p>

            {refused.length > 0 && (
              <table className={styles.refusals}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Code</th>
                    <th>Why it was refused</th>
                  </tr>
                </thead>
                <tbody>
                  {refused.map((outcome) => (
                    <tr key={`${outcome.line}-${outcome.code}`}>
                      <td className={styles.line}>{outcome.line}</td>
                      <td className={styles.line}>{outcome.code}</td>
                      <td>{outcome.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
