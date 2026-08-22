import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';

import type { AccountGroup } from '@/entities/account-group';
import { createLedger } from '@/entities/ledger';
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

/** The columns an import is read from, and an export is written in. One list, so they match. */
const LEDGER_COLUMNS = [
  'code',
  'name',
  'accountGroupCode',
  'ledgerType',
  'openingBalance',
  'openingBalanceType',
  'maintainBillwise',
] as const;

interface RowOutcome {
  line: number;
  code: string;
  error: string | null;
}

/**
 * Getting a chart of accounts in and out of a spreadsheet.
 *
 * Setting up a company by hand is dozens of forms, and every accountant already keeps their chart
 * in a spreadsheet — so the useful thing is not another form but a way to bring that file in. The
 * export exists mostly to make the import obvious: take the file out, edit it, put it back, and the
 * columns are self-evidently right because the product wrote them.
 *
 * Rows are created one at a time against the ordinary ledger endpoint rather than through a bulk
 * route, so every row gets the same validation and the same duplicate-code refusal a typed one
 * does. That makes a partial import possible, which is why each row reports its own outcome — a
 * file of forty accounts where two are rejected should leave thirty-eight in place and say which
 * two failed, not refuse the lot.
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
      ['code', 'name', 'parentCode', 'groupType'],
      groups.map((group) => [
        group.code,
        group.name,
        group.parentId ? (groupCodeById.get(group.parentId) ?? '') : '',
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
      ]),
    );
  }

  async function importLedgers(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared straight away so choosing the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    setOutcomes(null);

    try {
      const rows = parseCsv(await file.text());
      const [header, ...body] = rows;

      if (!header) {
        setError('That file is empty.');
        return;
      }

      const index = LEDGER_COLUMNS.map((column) =>
        header.findIndex((cell) => cell.trim().toLowerCase() === column.toLowerCase()),
      );

      const missing = LEDGER_COLUMNS.filter((_, position) => index[position] === -1).slice(0, 3);
      // Only the first three are named: a file with the wrong header is missing all of them, and a
      // list of seven column names is not more helpful than a list of three.
      if (index[0] === -1 || index[1] === -1 || index[2] === -1) {
        setError(
          `That file has no ${missing.join(', ')} column. Export the ledgers first and edit that file.`,
        );
        return;
      }

      const results: RowOutcome[] = [];
      const cell = (row: string[], position: number) =>
        index[position] === -1 ? '' : (row[index[position]] ?? '').trim();

      for (const [offset, row] of body.entries()) {
        // The header is line 1, so the first body row is line 2 — which is what a spreadsheet shows.
        const line = offset + 2;
        const code = cell(row, 0);
        if (code === '') continue;

        try {
          const opening = cell(row, 4);
          await createLedger(companyId, {
            code,
            name: cell(row, 1),
            accountGroupCode: cell(row, 2),
            ledgerType: (cell(row, 3) || 'GENERAL') as Ledger['ledgerType'],
            openingBalance: opening === '' ? undefined : Number(opening),
            openingBalanceType:
              cell(row, 5).toUpperCase() === 'CREDIT' ? 'CREDIT' : ('DEBIT' as const),
            maintainBillwise: cell(row, 6).toLowerCase() === 'true',
          });
          results.push({ line, code, error: null });
        } catch (err) {
          results.push({ line, code, error: getErrorMessage(err, 'Refused') });
        }
      }

      setOutcomes(results);
      if (results.some((result) => result.error === null)) onImported();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read that file'));
    } finally {
      setBusy(false);
    }
  }

  const created = outcomes?.filter((outcome) => outcome.error === null).length ?? 0;
  const refused = outcomes?.filter((outcome) => outcome.error !== null) ?? [];

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
        <h2 className={styles.title}>Import ledgers</h2>
        <p className={styles.note}>
          A CSV with a <code>code</code>, <code>name</code> and <code>accountGroupCode</code>{' '}
          column; the rest are optional. Each row is created the same way a typed one is, so a
          duplicate code is refused rather than overwriting the account that has it. Rows are
          independent — the ones that are accepted stay, and the ones that are not are listed below.
        </p>

        <label className={styles.upload}>
          <input type="file" accept=".csv,text/csv" onChange={importLedgers} disabled={busy} />
          <span className={styles.uploadFace}>
            <Upload size={14} /> {busy ? 'Reading…' : 'Choose a CSV file'}
          </span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {outcomes && (
          <div className={styles.outcome} role="status">
            <p className={created > 0 ? styles.created : styles.note}>
              {created === 0
                ? 'Nothing was created.'
                : `${created} ledger${created === 1 ? '' : 's'} created.`}
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
