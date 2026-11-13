import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';

import {
  createAccountGroup,
  listAccountGroups,
  updateAccountGroup,
} from '@/entities/account-group';
import type { AccountGroup, AccountNature, GroupType } from '@/entities/account-group';
import type { Currency } from '@/entities/currency';
import { createLedger, listLedgers, updateLedger } from '@/entities/ledger';
import type { Ledger } from '@/entities/ledger';
import { Badge, Button } from '@/shared/ui';
import {
  downloadCsv,
  formatMoney,
  getErrorMessage,
  isLegacyXlsFile,
  isXlsxFile,
  parseCsv,
  readXlsxRows,
} from '@/shared/lib';

import styles from './ImportExportPanel.module.css';

interface ImportExportPanelProps {
  companyId: string;
  companyCode: string;
  groups: AccountGroup[];
  ledgers: Ledger[];
  /**
   * Needed to write a ledger's currency as its code rather than its id: the export is read by a
   * person, and the import sends `currencyCode` back. Already loaded by the dashboard around this
   * panel, so it is passed down rather than fetched again.
   */
  currencies: Currency[];
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
  /*
    Appended rather than slotted in beside the fields they belong with, so a file exported before
    they existed still imports: a column that is not there leaves its field alone.

    `currencyCode` is the one that is not merely convenient. An account denominated in a currency
    that is not the company's own can otherwise only be set one form at a time, and it is what
    every voucher line posted against that account inherits.
  */
  'currencyCode',
  'creditLimit',
  'creditDays',
] as const;

/**
 * The same for groups.
 *
 * `nature` is not decoration: creating a group requires it, and the export left it out — which
 * meant the file this screen produced was one the same screen could not read back.
 */
const GROUP_COLUMNS = ['code', 'name', 'parentCode', 'nature', 'groupType'] as const;

const NATURES: AccountNature[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'];
const GROUP_TYPES: GroupType[] = ['BALANCE_SHEET', 'PROFIT_LOSS'];
const LEDGER_TYPES: Ledger['ledgerType'][] = ['GENERAL', 'CASH', 'BANK'];

/** What the two upload inputs take: CSV, or an Excel workbook (its first sheet). */
const ACCEPTED_FILES =
  '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** What became of one line of the file. */
interface RowOutcome {
  line: number;
  code: string;
  /** `null` when it worked; the reason it did not, otherwise. */
  error: string | null;
  created: boolean;
}

/** The fields a ledger row sends — only the ones its file carried. */
type LedgerFields = Partial<{
  name: string;
  accountGroupCode: string;
  ledgerType: Ledger['ledgerType'];
  openingBalance: number;
  openingBalanceType: Ledger['openingBalanceType'];
  maintainBillwise: boolean;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currencyCode: string | null;
  creditLimit: number | null;
  creditDays: number | null;
}>;

/**
 * One row of the file as the preview shows it, and as the import will send it.
 *
 * Every row is worked out — and checked as far as the screen can check it — before anything is
 * written, so the reader sees what the file will do while there is still time to fix it. A row
 * with a `problem` is shown but never sent.
 */
interface LedgerPlanRow {
  line: number;
  code: string;
  existingId: string | null;
  fields: LedgerFields;
  problem: string | null;
  /** What the preview table shows: the name, group and opening balance after this import. */
  name: string;
  group: string;
  opening: string;
}

interface GroupPlanRow {
  line: number;
  code: string;
  existingId: string | null;
  name: string;
  parentCode: string;
  nature: AccountNature;
  groupType: GroupType;
  problem: string | null;
  /** Said beside an update that will not do everything the file asks for. */
  note: string | null;
}

type ImportPlan =
  | {
      kind: 'ledgers';
      fileName: string;
      rows: LedgerPlanRow[];
      /** Every ledger's opening balance once this file is in — the totals that must agree. */
      totals: { debit: number; credit: number };
    }
  | { kind: 'groups'; fileName: string; rows: GroupPlanRow[] };

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
 * Reads a chosen file into rows, whichever format it is in. Excel is read from its first sheet;
 * anything else is read as CSV. The old binary `.xls` is refused with advice rather than being
 * read as text and failing on a header that is nothing but noise.
 */
async function readTable(file: File): Promise<string[][]> {
  if (isXlsxFile(file)) return readXlsxRows(await file.arrayBuffer());
  if (isLegacyXlsFile(file)) {
    throw new Error(
      'That is an old-style Excel file (.xls). Open it in Excel and save it as .xlsx or CSV.',
    );
  }
  return parseCsv(await file.text());
}

/**
 * Lines a table's header up with the columns expected, and returns a reader that answers by
 * column name, so the rest of the import never counts commas. A column that is absent reads as
 * `undefined` rather than as an empty string — the difference decides whether an update clears a
 * field or leaves it alone.
 */
function readColumns(table: string[][], columns: readonly string[], required: string[]) {
  const [header, ...body] = table;
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

/**
 * What one cell of an optional field is asking for. Three states, not two: an absent column
 * leaves the field alone, a present but empty cell asks for it to be cleared, and anything else
 * sets it.
 *
 * The empty case is the one that was wrong, and it made the round trip useless for the books
 * this panel exists to serve. `gstin: ''` is not "no GSTIN" to the server — it is a GSTIN that
 * fails its pattern — so a chart exported and read straight back in had every row refused over
 * columns it had never filled in. Clearing is `null`, which is what the update DTO documents.
 */
function clearable(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  return raw === '' ? null : raw;
}

/**
 * The same three states for a number, refusing a cell that is not one.
 *
 * Left to `Number()`, "abc" becomes `NaN`, JSON writes it as `null`, and the server reads that
 * as a request to clear the field — a typo silently wiping a credit limit. Throwing puts the row
 * in the problem list with the reason on it, which is the whole point of reporting per row.
 */
function clearableNumber(raw: string | undefined, column: string): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === '') return null;
  const parsed = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) throw new Error(`${column} is not a number: "${raw}"`);
  return parsed;
}

/**
 * The side of an opening balance, read strictly.
 *
 * It used to be "CREDIT, or else DEBIT" — so `Cr`, `CR.` or a typo all became Debit, and a
 * supplier the company owes ₹15,000 went in as ₹15,000 owed *to* it: the books out by twice the
 * amount, with nothing to say so. The usual spellings are accepted; anything else stops the row.
 */
function balanceSide(raw: string | undefined): Ledger['openingBalanceType'] | undefined {
  if (raw === undefined || raw === '') return undefined;
  const word = raw.toUpperCase().replace(/[.\s]/g, '');
  if (word === 'DEBIT' || word === 'DR' || word === 'D') return 'DEBIT';
  if (word === 'CREDIT' || word === 'CR' || word === 'C') return 'CREDIT';
  throw new Error(`openingBalanceType must be DEBIT or CREDIT (or Dr / Cr), not "${raw}"`);
}

function yesNo(raw: string | undefined, column: string): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const word = raw.toLowerCase();
  if (word === 'true' || word === 'yes' || word === 'y' || word === '1') return true;
  if (word === 'false' || word === 'no' || word === 'n' || word === '0') return false;
  throw new Error(`${column} must be true or false, not "${raw}"`);
}

/**
 * A record being created has nothing to clear, and the create DTO takes no nulls.
 *
 * The return type drops `null` as well as dropping the values, so the create call type-checks
 * against a DTO that never accepted one — rather than being asserted past.
 */
function withoutNulls<T extends Record<string, unknown>>(
  fields: T,
): { [K in keyof T]?: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>;
  };
}

/** Marks every repeat of a code after its first, which would otherwise overwrite the first. */
function firstLineByCode(rows: Array<{ code: string; line: number }>) {
  const first = new Map<string, number>();
  for (const row of rows) if (!first.has(row.code)) first.set(row.code, row.line);
  return (row: { code: string; line: number }) => {
    const line = first.get(row.code) as number;
    return line === row.line ? null : `Code ${row.code} is already on line ${line} of this file`;
  };
}

/**
 * Getting a chart of accounts in and out of a spreadsheet.
 *
 * Setting up a company by hand is dozens of forms, and every accountant already keeps their chart
 * in a spreadsheet — so the useful thing is not another form but a way to bring that file in. The
 * export exists mostly to make the import obvious: take the file out, edit it, put it back, and the
 * columns are self-evidently right because the product wrote them.
 *
 * A file is read — CSV or Excel — into a preview first, and nothing is written until the reader
 * presses Import. Each row says whether it creates an account, updates one, or has a problem that
 * keeps it out; the ledger preview also totals every opening balance as it will stand afterwards,
 * because debits and credits that do not agree are the mistake an import most often makes.
 *
 * Rows go in one at a time against the ordinary endpoints rather than through a bulk route, so
 * every row gets the same validation a typed one does. That makes a partial import possible, which
 * is why each row reports its own outcome — a file of forty accounts where two are rejected should
 * leave thirty-eight in place and say which two failed, not refuse the lot.
 *
 * A code that already exists is updated rather than refused, so a chart can be exported, corrected
 * in a spreadsheet, and put back.
 */
export function ImportExportPanel({
  companyId,
  companyCode,
  groups,
  ledgers,
  currencies,
  onImported,
}: ImportExportPanelProps) {
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
    Kept apart from `error`, which belongs to the import and is drawn inside that card. A warning
    about the file being written is no use underneath the heading for reading one back, and sharing
    the state would also have an export quietly clear a refusal the reader had not dealt with yet.
  */
  const [exportNote, setExportNote] = useState<string | null>(null);

  const groupCodeById = new Map(groups.map((group) => [group.id, group.code]));
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code]));
  const money = (value: number) => formatMoney(value);

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
    /*
      An account whose currency cannot be named. The list is loaded around this panel with a
      `.catch(() => [])`, so this is a state that happens rather than a hypothetical.

      It matters because of what an empty cell now means on the way back in. Writing the column
      blank would say "clear it", and a file taken on a day the currency list did not load would
      quietly strip the currency off every foreign account when it was read back — the one thing
      no other bulk path can set, undone by a file that looked complete. An absent column means
      "leave alone", so the column comes out instead and the reason is said.
    */
    const unnameable = ledgers.filter(
      (ledger) => ledger.currencyId && !currencyCodeById.has(ledger.currencyId),
    ).length;

    const columns = unnameable
      ? LEDGER_COLUMNS.filter((column) => column !== 'currencyCode')
      : [...LEDGER_COLUMNS];

    setExportNote(
      unnameable
        ? `Currencies could not be read, so the currency column is left out of this file — ` +
            `${unnameable} account${unnameable === 1 ? '' : 's'} would have been written blank, ` +
            `which on import would clear it. Everything else is here.`
        : null,
    );

    /*
      Keyed by column name rather than laid out in order. The two lists had to be kept in step by
      hand, and a column added to one but not the other would not fail — it would shift every cell
      after it one place left, writing each account's phone number into its credit limit.
    */
    downloadCsv(
      `${companyCode}-ledgers.csv`,
      [...columns],
      ledgers.map((ledger) => {
        const cells: Record<(typeof LEDGER_COLUMNS)[number], string> = {
          code: ledger.code,
          name: ledger.name,
          accountGroupCode: groupCodeById.get(ledger.accountGroupId) ?? '',
          ledgerType: ledger.ledgerType,
          openingBalance: ledger.openingBalance,
          openingBalanceType: ledger.openingBalanceType,
          maintainBillwise: String(ledger.maintainBillwise),
          gstin: ledger.gstin ?? '',
          pan: ledger.pan ?? '',
          address: ledger.address ?? '',
          contactEmail: ledger.contactEmail ?? '',
          contactPhone: ledger.contactPhone ?? '',
          currencyCode: ledger.currencyId ? (currencyCodeById.get(ledger.currencyId) ?? '') : '',
          creditLimit: ledger.creditLimit ?? '',
          creditDays: ledger.creditDays === undefined ? '' : String(ledger.creditDays),
        };
        return columns.map((column) => cells[column]);
      }),
    );
  }

  /**
   * Works out what a ledgers file will do, without writing anything.
   *
   * The chart is read now rather than taken from the props this panel was given: the props come
   * from the screen around it, which refreshes after an import — so just after one finishes they
   * describe the chart as it was before, and the same file previewed twice would plan to create
   * accounts that already exist.
   */
  async function planLedgers(file: File): Promise<ImportPlan> {
    const { rows, value } = readColumns(await readTable(file), LEDGER_COLUMNS, [
      'code',
      'name',
      'accountGroupCode',
    ]);
    const [current, currentGroups] = await Promise.all([
      listLedgers(companyId),
      listAccountGroups(companyId),
    ]);
    const existing = new Map(current.map((ledger) => [ledger.code, ledger]));
    const groupByCode = new Map(currentGroups.map((group) => [group.code, group]));
    const groupCodeOf = new Map(currentGroups.map((group) => [group.id, group.code]));
    const repeated = firstLineByCode(rows);

    const planned = rows.map(({ line, code, row }): LedgerPlanRow => {
      const at = (column: string) => value(row, column);
      const already = existing.get(code) ?? null;
      const base = {
        line,
        code,
        existingId: already?.id ?? null,
        name: at('name') || already?.name || '',
        group:
          at('accountGroupCode') ||
          (already ? (groupCodeOf.get(already.accountGroupId) ?? '') : ''),
        opening: '',
      };

      try {
        const duplicate = repeated({ code, line });
        if (duplicate) throw new Error(duplicate);

        const opening = clearableNumber(at('openingBalance'), 'openingBalance');
        if (opening !== undefined && opening !== null && opening < 0) {
          throw new Error('openingBalance cannot be negative — put the side in openingBalanceType');
        }
        const side = balanceSide(at('openingBalanceType'));
        const ledgerType = at('ledgerType')?.toUpperCase() || undefined;
        if (ledgerType && !LEDGER_TYPES.includes(ledgerType as Ledger['ledgerType'])) {
          throw new Error(`ledgerType must be GENERAL, CASH or BANK, not "${at('ledgerType')}"`);
        }

        const fields: LedgerFields = present({
          /*
            These four cannot be cleared — the server requires each to be something — so an empty
            cell reads as "leave it as it was" rather than as a request to blank a ledger's name.
          */
          name: at('name') || undefined,
          accountGroupCode: at('accountGroupCode') || undefined,
          ledgerType: ledgerType as Ledger['ledgerType'] | undefined,
          openingBalance: opening ?? undefined,
          openingBalanceType: side,
          maintainBillwise: yesNo(at('maintainBillwise'), 'maintainBillwise'),
          gstin: clearable(at('gstin')),
          pan: clearable(at('pan')),
          address: clearable(at('address')),
          contactEmail: clearable(at('contactEmail')),
          contactPhone: clearable(at('contactPhone')),
          // Upper-cased because a currency is known by its code and nobody types it in caps.
          currencyCode: clearable(at('currencyCode')?.toUpperCase()),
          creditLimit: clearableNumber(at('creditLimit'), 'creditLimit'),
          creditDays: clearableNumber(at('creditDays'), 'creditDays'),
        });

        if (!already && !fields.name) throw new Error('name is empty');
        if (!already && !fields.accountGroupCode) throw new Error('accountGroupCode is empty');
        if (fields.accountGroupCode && !groupByCode.has(fields.accountGroupCode)) {
          throw new Error(
            `There is no account group ${fields.accountGroupCode} — import or create it first`,
          );
        }
        // A new account's balance with no side would be filed as a debit by default. Asked for
        // rather than assumed: the wrong side puts the books out by twice the amount.
        if (!already && (fields.openingBalance ?? 0) > 0 && !fields.openingBalanceType) {
          throw new Error('Say whether the opening balance is DEBIT or CREDIT');
        }

        const amount = fields.openingBalance ?? Number(already?.openingBalance ?? 0);
        const sideAfter = fields.openingBalanceType ?? already?.openingBalanceType ?? 'DEBIT';
        return {
          ...base,
          fields,
          problem: null,
          opening: amount > 0 ? `${money(amount)} ${sideAfter === 'CREDIT' ? 'Cr' : 'Dr'}` : '—',
        };
      } catch (err) {
        return { ...base, fields: {}, problem: getErrorMessage(err, 'Cannot be read') };
      }
    });

    /*
      The opening balances as the whole chart will hold them once the accepted rows are in — the
      accounts this file does not touch included, since the two sides only have to agree across
      the lot. A row with a problem changes nothing, so its account counts as it stands today.
    */
    const after = new Map(
      current.map((ledger) => [
        ledger.code,
        { amount: Number(ledger.openingBalance) || 0, side: ledger.openingBalanceType },
      ]),
    );
    for (const row of planned) {
      if (row.problem) continue;
      const was = after.get(row.code);
      after.set(row.code, {
        amount: row.fields.openingBalance ?? was?.amount ?? 0,
        side: row.fields.openingBalanceType ?? was?.side ?? 'DEBIT',
      });
    }
    const totals = { debit: 0, credit: 0 };
    for (const { amount, side } of after.values()) {
      if (side === 'CREDIT') totals.credit += amount;
      else totals.debit += amount;
    }

    return { kind: 'ledgers', fileName: file.name, rows: planned, totals };
  }

  /** Works out what a groups file will do, without writing anything. */
  async function planGroups(file: File): Promise<ImportPlan> {
    const { rows, value } = readColumns(await readTable(file), GROUP_COLUMNS, [
      'code',
      'name',
      'nature',
      'groupType',
    ]);
    const current = await listAccountGroups(companyId);
    const existing = new Map(current.map((group) => [group.code, group]));
    const codeOf = new Map(current.map((group) => [group.id, group.code]));
    const repeated = firstLineByCode(rows);

    const planned = rows.map(({ line, code, row }): GroupPlanRow => {
      const at = (column: string) => value(row, column);
      const already = existing.get(code) ?? null;
      const nature = (at('nature') ?? '').toUpperCase() as AccountNature;
      const groupType = (at('groupType') ?? '').toUpperCase() as GroupType;
      const parentCode = at('parentCode') ?? '';
      const planRow: GroupPlanRow = {
        line,
        code,
        existingId: already?.id ?? null,
        name: at('name') || already?.name || '',
        parentCode,
        nature,
        groupType,
        problem: repeated({ code, line }),
        note: null,
      };

      if (planRow.problem) return planRow;
      if (!already && !at('name')) return { ...planRow, problem: 'name is empty' };
      if (!NATURES.includes(nature)) {
        return {
          ...planRow,
          problem: `nature must be ASSET, LIABILITY, INCOME or EXPENSE, not "${at('nature')}"`,
        };
      }
      if (!GROUP_TYPES.includes(groupType)) {
        return {
          ...planRow,
          problem: `groupType must be BALANCE_SHEET or PROFIT_LOSS, not "${at('groupType')}"`,
        };
      }

      if (already) {
        /*
          The API takes a name and an active flag for an existing group; its nature, parent and
          type are fixed once it holds postings. Said here rather than reported as a plain
          "update", which read as though the file's other columns had been applied.
        */
        const ignored = [
          already.nature !== nature && 'nature',
          already.groupType !== groupType && 'groupType',
          (already.parentId ? (codeOf.get(already.parentId) ?? '') : '') !== parentCode &&
            'parentCode',
        ].filter(Boolean);
        return {
          ...planRow,
          note:
            ignored.length > 0
              ? `Only the name is updated — ${ignored.join(', ')} of an existing group cannot be changed by import`
              : null,
        };
      }
      return planRow;
    });

    /*
      A new group's parent must already exist or be a good row of this same file. Worked to a fixed
      point, so a child of a refused row is refused too rather than failing later on the server.
    */
    const placeable = new Set(current.map((group) => group.code));
    let moved = true;
    while (moved) {
      moved = false;
      for (const row of planned) {
        if (row.problem || placeable.has(row.code)) continue;
        if (!row.parentCode || placeable.has(row.parentCode)) {
          placeable.add(row.code);
          moved = true;
        }
      }
    }
    for (const row of planned) {
      if (!row.problem && !placeable.has(row.code)) {
        row.problem = `Its parent is not in this file and does not exist yet (${row.parentCode})`;
      }
    }

    return { kind: 'groups', fileName: file.name, rows: planned };
  }

  async function preview(event: ChangeEvent<HTMLInputElement>, kind: ImportPlan['kind']) {
    const file = event.target.files?.[0];
    // Cleared straight away so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    setOutcomes(null);
    setPlan(null);
    try {
      setPlan(kind === 'ledgers' ? await planLedgers(file) : await planGroups(file));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read that file'));
    } finally {
      setBusy(false);
    }
  }

  async function applyLedgers(rows: LedgerPlanRow[]): Promise<RowOutcome[]> {
    // Ledgers are independent of one another — each names a group that already exists — so they
    // can go up together. Groups cannot, which is why only this side is parallel.
    return mapWithLimit(rows, CONCURRENCY, async ({ line, code, existingId, fields }) => {
      try {
        if (existingId) {
          await updateLedger(companyId, existingId, fields);
          return { line, code, error: null, created: false };
        }
        const fresh = withoutNulls(fields);
        await createLedger(companyId, {
          code,
          name: fresh.name ?? '',
          accountGroupCode: fresh.accountGroupCode ?? '',
          ledgerType: fresh.ledgerType ?? 'GENERAL',
          ...fresh,
        });
        return { line, code, error: null, created: true };
      } catch (err) {
        return { line, code, error: getErrorMessage(err, 'Refused'), created: false };
      }
    });
  }

  async function applyGroups(rows: GroupPlanRow[]): Promise<RowOutcome[]> {
    /*
      A group names its parent, and a file may well carry both. Sent in the order written, a child
      that comes before its parent is refused for a parent that is about to exist — so the rows are
      walked repeatedly, taking whichever can go next, until a pass achieves nothing.

      Sequential for the same reason: each pass depends on what the one before it created.
    */
    const results: RowOutcome[] = [];
    const known = new Set((await listAccountGroups(companyId)).map((group) => group.code));
    let pending = rows;

    while (pending.length > 0) {
      const ready = pending.filter((row) => !row.parentCode || known.has(row.parentCode));
      if (ready.length === 0) break;

      for (const row of ready) {
        try {
          if (row.existingId) {
            await updateAccountGroup(companyId, row.existingId, { name: row.name });
            results.push({ line: row.line, code: row.code, error: null, created: false });
          } else {
            await createAccountGroup(companyId, {
              code: row.code,
              name: row.name,
              parentCode: row.parentCode || undefined,
              nature: row.nature,
              groupType: row.groupType,
            });
            results.push({ line: row.line, code: row.code, error: null, created: true });
          }
        } catch (err) {
          results.push({
            line: row.line,
            code: row.code,
            error: getErrorMessage(err, 'Refused'),
            created: false,
          });
        }
        // Known even when refused, so its children are attempted and fail on their own terms
        // rather than being reported as orphans because of a fault one row above them.
        known.add(row.code);
      }

      const done = new Set(ready.map((row) => row.line));
      pending = pending.filter((row) => !done.has(row.line));
    }

    for (const row of pending) {
      results.push({
        line: row.line,
        code: row.code,
        error: 'Its parent is not in this file and does not exist yet.',
        created: false,
      });
    }
    return results;
  }

  async function confirmImport() {
    if (!plan) return;
    setBusy(true);
    setError(null);

    try {
      const skipped: RowOutcome[] = plan.rows
        .filter((row) => row.problem)
        .map((row) => ({
          line: row.line,
          code: row.code,
          error: `Skipped: ${row.problem}`,
          created: false,
        }));

      const sent =
        plan.kind === 'ledgers'
          ? await applyLedgers(plan.rows.filter((row) => !row.problem))
          : await applyGroups(plan.rows.filter((row) => !row.problem));

      const results = [...sent, ...skipped].sort((a, b) => a.line - b.line);
      setOutcomes(results);
      setPlan(null);
      if (results.some((result) => result.error === null)) onImported();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not import that file'));
    } finally {
      setBusy(false);
    }
  }

  const ready = plan?.rows.filter((row) => !row.problem) ?? [];
  const toCreate = ready.filter((row) => !row.existingId).length;
  const toUpdate = ready.length - toCreate;
  const withProblems = (plan?.rows.length ?? 0) - ready.length;
  const difference =
    plan?.kind === 'ledgers' ? Math.round((plan.totals.debit - plan.totals.credit) * 100) / 100 : 0;

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

        {exportNote && (
          <p className={styles.error} role="alert">
            {exportNote}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.title}>Import</h2>
        <p className={styles.note}>
          Choose a CSV or Excel (.xlsx) file — Excel is read from its first sheet. You see a preview
          first, and nothing is saved until you press Import. A code that is already in use is
          updated; anything else is created. A column the file does not carry is left as it was, but
          a column that is there with the cell <strong>empty clears that field</strong>.
        </p>

        <div className={styles.actions}>
          <label className={styles.upload}>
            <input
              type="file"
              accept={ACCEPTED_FILES}
              onChange={(event) => preview(event, 'groups')}
              disabled={busy}
            />
            <span className={styles.uploadFace}>
              <Upload size={14} /> {busy ? 'Reading…' : 'Account groups (CSV / Excel)'}
            </span>
          </label>

          <label className={styles.upload}>
            <input
              type="file"
              accept={ACCEPTED_FILES}
              onChange={(event) => preview(event, 'ledgers')}
              disabled={busy}
            />
            <span className={styles.uploadFace}>
              <Upload size={14} /> {busy ? 'Reading…' : 'Ledgers (CSV / Excel)'}
            </span>
          </label>
        </div>

        <p className={styles.note}>
          Groups need <code>code</code>, <code>name</code>, <code>nature</code> and{' '}
          <code>groupType</code>; ledgers need <code>code</code>, <code>name</code> and{' '}
          <code>accountGroupCode</code>. Import groups before the ledgers that use them. A group
          whose parent is further down the same file is still created.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {plan && (
          <div className={styles.preview} aria-label="Import preview">
            <p className={styles.previewTitle}>Preview · {plan.fileName}</p>
            <p className={styles.note}>
              {toCreate} new · {toUpdate} to update
              {withProblems > 0 && (
                <>
                  {' '}
                  · <strong>{withProblems} with problems</strong> (will be skipped)
                </>
              )}
            </p>

            {/*
              The one check that spans the whole file: opening balances must agree, debit to
              credit, or the trial balance opens with a difference nobody can trace to a voucher.
            */}
            {plan.kind === 'ledgers' && (
              <p className={difference === 0 ? styles.balanceOk : styles.balanceOff} role="status">
                Opening balances after this import: Dr {money(plan.totals.debit)} · Cr{' '}
                {money(plan.totals.credit)}
                {difference === 0
                  ? ' — balanced'
                  : ` — out by ${money(Math.abs(difference))}. Debit and credit should be equal.`}
              </p>
            )}

            <div className={styles.previewFrame}>
              <table className={styles.refusals}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Code</th>
                    <th>Name</th>
                    {plan.kind === 'ledgers' ? (
                      <>
                        <th>Group</th>
                        <th>Opening</th>
                      </>
                    ) : (
                      <>
                        <th>Parent</th>
                        <th>Nature</th>
                      </>
                    )}
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.kind === 'ledgers'
                    ? plan.rows.map((row) => (
                        <tr key={row.line}>
                          <td className={styles.line}>{row.line}</td>
                          <td className={styles.line}>{row.code}</td>
                          <td>{row.name}</td>
                          <td className={styles.line}>{row.group}</td>
                          <td className={styles.line}>{row.opening}</td>
                          <td>
                            <RowResult problem={row.problem} existing={Boolean(row.existingId)} />
                          </td>
                        </tr>
                      ))
                    : plan.rows.map((row) => (
                        <tr key={row.line}>
                          <td className={styles.line}>{row.line}</td>
                          <td className={styles.line}>{row.code}</td>
                          <td>{row.name}</td>
                          <td className={styles.line}>{row.parentCode || '—'}</td>
                          <td className={styles.line}>{row.nature}</td>
                          <td>
                            <RowResult
                              problem={row.problem}
                              existing={Boolean(row.existingId)}
                              note={row.note}
                            />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <div className={styles.actions}>
              <Button
                variant="primary"
                onClick={confirmImport}
                disabled={busy || ready.length === 0}
              >
                {busy ? 'Importing…' : `Import ${ready.length} row${ready.length === 1 ? '' : 's'}`}
              </Button>
              <Button variant="ghost" onClick={() => setPlan(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
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

/** What one previewed row will do: create, update, or nothing — with the reason. */
function RowResult({
  problem,
  existing,
  note,
}: {
  problem: string | null;
  existing: boolean;
  note?: string | null;
}) {
  if (problem) {
    return (
      <span className={styles.problem}>
        <Badge variant="danger">Problem</Badge> {problem}
      </span>
    );
  }
  return (
    <span className={styles.problem}>
      <Badge variant={existing ? 'info' : 'success'}>{existing ? 'Update' : 'New'}</Badge>
      {note && <span className={styles.rowNote}> {note}</span>}
    </span>
  );
}
