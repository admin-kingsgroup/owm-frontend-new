import { useState } from 'react';

import {
  uploadStatement,
  type StatementFormat,
  type UploadStatementResult,
} from '@/entities/bank-statement';
import { cn, getErrorMessage } from '@/shared/lib';
import { Button, Input, Modal, Select, Table } from '@/shared/ui';

import { PdfPasswordError } from '../lib/pdf';
import { readStatementFile } from '../lib/read-statement';
import {
  applyColumnMap,
  checkLines,
  COLUMN_ROLE_LABELS,
  detectDateOrder,
  findHeaderRow,
  fromPaise,
  guessRoles,
  parseAmount,
  savedMapFits,
  toPaise,
  totalsOf,
  type ColumnMap,
  type ColumnRole,
  type DateOrder,
  type DraftLine,
  type ReadLines,
  type SavedColumnMap,
} from '../lib/statement-table';
import styles from './UploadStatementDialog.module.css';

interface UploadStatementDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  ledgerId: string;
  ledgerName: string;
  /** The column mapping used for this account's last file, offered again when the headers agree. */
  savedMap: SavedColumnMap | null;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  onUploaded: (result: UploadStatementResult) => void;
}

type Step = 'pick' | 'reading' | 'password' | 'map' | 'review';

const ROLES = Object.keys(COLUMN_ROLE_LABELS) as ColumnRole[];

/** Issues that stop a line being sent; the rest are warnings a person may accept. */
const blocking = (issue: string) => issue.startsWith('Needs') || issue.startsWith('Could not');

/**
 * Upload a bank statement: pick the file, say which column is which, check the lines, send them.
 *
 * Nothing reaches the server until the last step. The person sees every line as it was read —
 * with the running-balance check pointing at any figure that does not add up — and can correct
 * or leave out any of them first. That matters most for a scanned PDF, where the text came from
 * OCR and a misread digit is a real possibility.
 */
export function UploadStatementDialog({
  open,
  onClose,
  companyId,
  ledgerId,
  ledgerName,
  savedMap,
  money,
  onUploaded,
}: UploadStatementDialogProps) {
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState('');
  const [password, setPassword] = useState('');
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [format, setFormat] = useState<StatementFormat>('CSV');
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [read, setRead] = useState<ReadLines | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [autoMapped, setAutoMapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function reset() {
    setStep('pick');
    setFile(null);
    setProgress('');
    setPassword('');
    setPasswordWrong(false);
    setRows([]);
    setMap(null);
    setRead(null);
    setOnlyProblems(false);
    setAutoMapped(false);
    setError(null);
    setSending(false);
  }

  function close() {
    if (sending) return;
    reset();
    onClose();
  }

  /** Builds the first mapping for a table: the header row, a guess per column, the date order. */
  /**
   * The first mapping for a table: the header row, a guess per column, the date order. `sure` is
   * whether it is good enough to skip straight to checking the lines — a header was found, the
   * date and money columns were named, and the lines it reads mostly need nothing fixing.
   */
  function firstMapping(table: string[][]): { map: ColumnMap; read: ReadLines; sure: boolean } {
    const found = findHeaderRow(table);
    const headerRow = found === -1 ? 0 : found;
    const header = table[headerRow] ?? [];
    const fits = savedMapFits(savedMap, header);
    const roles = fits && savedMap ? savedMap.roles : guessRoles(header);
    const dateColumn = roles.indexOf('date');
    const dateOrder: DateOrder =
      fits && savedMap
        ? savedMap.dateOrder
        : detectDateOrder(table.slice(headerRow + 1).map((row) => row[dateColumn] ?? ''));
    const map = { headerRow, roles, dateOrder };
    const read = applyColumnMap(table, map);
    const named =
      roles.includes('date') &&
      roles.some((role) => role === 'withdrawal' || role === 'deposit' || role === 'amount');
    const broken = read.lines.filter((line) => line.issues.some(blocking)).length;
    const sure =
      found !== -1 && named && read.lines.length > 0 && broken <= read.lines.length * 0.1;
    return { map, read, sure };
  }

  async function readFile(chosen: File, withPassword?: string) {
    setError(null);
    setStep('reading');
    try {
      const result = await readStatementFile(chosen, {
        password: withPassword,
        progress: setProgress,
      });
      setFormat(result.format);
      if (result.kind === 'lines') {
        if (result.lines.length === 0) throw new Error('No transactions were found in that file.');
        setRead({
          lines: result.lines,
          openingBalance: result.openingBalance,
          closingBalance: result.closingBalance,
        });
        setStep('review');
      } else {
        if (result.rows.length === 0) throw new Error('That file is empty.');
        setRows(result.rows);
        const first = firstMapping(result.rows);
        setMap(first.map);
        if (first.sure) {
          // The columns were recognised: go straight to the lines. "Back to columns" is there
          // if a guess turns out wrong.
          setRead(first.read);
          setAutoMapped(true);
          setStep('review');
        } else {
          setStep('map');
        }
      }
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setPasswordWrong(err.incorrect);
        setStep('password');
        return;
      }
      setError(getErrorMessage(err, 'That file could not be read'));
      setStep('pick');
    }
  }

  function chooseFile(chosen: File | undefined) {
    if (!chosen) return;
    setFile(chosen);
    void readFile(chosen);
  }

  function readWithMap() {
    if (!map) return;
    if (!map.roles.includes('date')) {
      setError('Say which column holds the date.');
      return;
    }
    if (
      !map.roles.some((role) => role === 'withdrawal' || role === 'deposit' || role === 'amount')
    ) {
      setError('Say which columns hold the money: withdrawal and deposit, or one amount column.');
      return;
    }
    const result = applyColumnMap(rows, map);
    if (result.lines.length === 0) {
      setError(
        'No lines with a date and an amount were found. Check the header row, the date column and the date order.',
      );
      return;
    }
    setError(null);
    setRead(result);
    setStep('review');
  }

  function editLine(key: string, patch: Partial<DraftLine>) {
    if (!read) return;
    const lines = read.lines.map((line) =>
      line.key === key
        ? {
            ...line,
            ...patch,
            // Editing a line is answering what it was flagged for; the checks run again below.
            issues: line.issues.filter((issue) => issue.startsWith('Not booked')),
          }
        : line,
    );
    setRead(checkLines({ ...read, lines }, false));
  }

  /** Tidies a typed amount: "1,25,000" becomes "125000.00"; anything unreadable is left to flag. */
  function settleAmount(key: string, field: 'withdrawal' | 'deposit', value: string) {
    const parsed = parseAmount(value);
    editLine(key, { [field]: parsed && parsed.value !== '0.00' ? parsed.value : '' });
  }

  async function send() {
    if (!read || !file) return;
    const included = read.lines.filter((line) => line.include);
    if (included.some((line) => line.issues.some(blocking))) {
      setError(
        'Some lines still need a date or an amount. Fix them, or untick them to leave them out.',
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      const header = map ? (rows[map.headerRow] ?? []) : [];
      const result = await uploadStatement(companyId, ledgerId, {
        fileName: file.name,
        format,
        columnMap: map
          ? ({
              headers: header,
              roles: map.roles,
              dateOrder: map.dateOrder,
            } satisfies SavedColumnMap)
          : undefined,
        openingBalance: read.openingBalance,
        closingBalance: read.closingBalance,
        lines: included.map((line) => ({
          txnDate: line.txnDate,
          valueDate: line.valueDate || undefined,
          description: line.description,
          reference: line.reference || undefined,
          withdrawal: line.withdrawal || '0',
          deposit: line.deposit || '0',
          balance: line.balance || undefined,
        })),
      });
      onUploaded(result);
      reset();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'The statement could not be uploaded'));
      setSending(false);
    }
  }

  const header = map ? (rows[map.headerRow] ?? []) : [];
  const columnCount = Math.max(header.length, ...rows.slice(0, 50).map((row) => row.length), 0);
  const totals = read ? totalsOf(read.lines) : null;
  const balanceIssues = read
    ? read.lines.filter(
        (line) => line.include && line.issues.some((issue) => issue.startsWith('Running')),
      ).length
    : 0;

  /* Opening plus deposits less withdrawals should land on the closing balance the bank printed. */
  const framed =
    read?.openingBalance !== undefined && read?.closingBalance !== undefined && totals
      ? fromPaise(
          toPaise(read.openingBalance) + toPaise(totals.deposits) - toPaise(totals.withdrawals),
        )
      : null;
  const frameAgrees =
    framed !== null &&
    read?.closingBalance !== undefined &&
    toPaise(framed) === toPaise(read.closingBalance);

  const shown = read
    ? onlyProblems
      ? read.lines.filter((line) => line.issues.length > 0)
      : read.lines
    : [];

  return (
    <Modal open={open} onClose={close} title={`Upload statement — ${ledgerName}`} size="wide">
      <div className={styles.body}>
        <ol className={styles.steps} aria-label="Steps">
          <li
            className={cn(
              step === 'pick' || step === 'reading' || step === 'password'
                ? styles.stepNow
                : styles.stepDone,
            )}
          >
            1. Choose file
          </li>
          <li
            className={cn(step === 'map' && styles.stepNow, step === 'review' && styles.stepDone)}
          >
            2. Name the columns
          </li>
          <li className={cn(step === 'review' && styles.stepNow)}>3. Check and upload</li>
        </ol>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {step === 'pick' && (
          <>
            <p className={styles.lead}>
              Download the statement from net banking and choose it here. Lines already uploaded are
              skipped, so an overlapping period is safe.
            </p>
            <label className={styles.drop}>
              <input
                type="file"
                accept=".csv,.txt,.tsv,.xlsx,.xls,.xml,.pdf"
                className={styles.fileInput}
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />
              <span className={styles.dropTitle}>Choose a statement file</span>
              <span className={styles.dropHint}>
                CSV · Excel (.xlsx) · camt.053 XML · PDF — a scanned PDF is read by OCR
              </span>
            </label>
          </>
        )}

        {step === 'reading' && (
          <p className={styles.progress} role="status">
            {progress || 'Reading…'}
          </p>
        )}

        {step === 'password' && file && (
          <form
            className={styles.passwordForm}
            onSubmit={(event) => {
              event.preventDefault();
              void readFile(file, password);
            }}
          >
            <p className={styles.lead}>
              {passwordWrong
                ? 'That password did not open it. Try again.'
                : 'This PDF is locked with a password. Banks often use your customer ID, date of birth or a mix — check the email the statement came with.'}
            </p>
            <Input
              type="password"
              autoFocus
              autoComplete="off"
              aria-label="PDF password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={reset}>
                Choose another file
              </Button>
              <Button type="submit" disabled={!password}>
                Open
              </Button>
            </div>
          </form>
        )}

        {step === 'map' && map && (
          <>
            <p className={styles.lead}>
              Say what each column holds. The guesses come from the column headings
              {savedMapFits(savedMap, header) ? ', and match the last file from this bank' : ''}.
              {format === 'PDF_OCR' &&
                ' This PDF was a scan and was read by OCR — check the figures on the next step.'}
            </p>
            <div className={styles.mapControls}>
              <label className={styles.field}>
                <span className={styles.label}>Header row</span>
                <Select
                  value={map.headerRow}
                  onChange={(event) => {
                    const headerRow = Number(event.target.value);
                    setMap({ ...map, headerRow, roles: guessRoles(rows[headerRow] ?? []) });
                  }}
                >
                  {rows.slice(0, 60).map((row, index) => (
                    <option key={index} value={index}>
                      Row {index + 1}: {row.filter(Boolean).join(' | ').slice(0, 70)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Dates are written</span>
                <Select
                  value={map.dateOrder}
                  onChange={(event) =>
                    setMap({ ...map, dateOrder: event.target.value as DateOrder })
                  }
                >
                  <option value="DMY">Day first — 03/11/2026 is 3 November</option>
                  <option value="MDY">Month first — 11/03/2026 is 3 November</option>
                  <option value="YMD">Year first — 2026-11-03</option>
                </Select>
              </label>
            </div>

            <Table surface="card" density="tight" zebra={false} className={styles.mapTable}>
              <thead>
                <tr>
                  {Array.from({ length: columnCount }, (_, index) => (
                    <th key={index}>
                      <Select
                        aria-label={`Column ${index + 1}: ${header[index] ?? ''}`}
                        className={cn(
                          styles.roleSelect,
                          map.roles[index] && map.roles[index] !== 'ignore' && styles.roleSet,
                        )}
                        value={map.roles[index] ?? 'ignore'}
                        onChange={(event) => {
                          const roles = Array.from(
                            { length: columnCount },
                            (_, at) => map.roles[at] ?? 'ignore',
                          );
                          roles[index] = event.target.value as ColumnRole;
                          setMap({ ...map, roles });
                        }}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {COLUMN_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                      <span className={styles.heading}>
                        {header[index] || `Column ${index + 1}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(map.headerRow + 1, map.headerRow + 9).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: columnCount }, (_, index) => (
                      <td key={index} className={styles.sample}>
                        {row[index] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={reset}>
                Choose another file
              </Button>
              <Button type="button" onClick={readWithMap}>
                Read the lines
              </Button>
            </div>
          </>
        )}

        {step === 'review' && read && totals && (
          <>
            <div className={styles.summary}>
              <div>
                <span className={styles.label}>Lines</span>
                <strong>{totals.count}</strong>
              </div>
              <div>
                <span className={styles.label}>Withdrawals</span>
                <strong>{money(totals.withdrawals)}</strong>
              </div>
              <div>
                <span className={styles.label}>Deposits</span>
                <strong>{money(totals.deposits)}</strong>
              </div>
              {read.openingBalance !== undefined && (
                <div>
                  <span className={styles.label}>Opening balance</span>
                  <strong>{money(read.openingBalance)}</strong>
                </div>
              )}
              {read.closingBalance !== undefined && (
                <div>
                  <span className={styles.label}>Closing balance</span>
                  <strong>{money(read.closingBalance)}</strong>
                </div>
              )}
            </div>

            {autoMapped && (
              <p className={styles.lead}>
                The columns were recognised automatically. If a date or an amount below is in the
                wrong place, use <strong>Back to columns</strong> to correct which column is which.
              </p>
            )}
            {format === 'PDF_OCR' && (
              <p className={styles.warning}>
                This statement was a scan, read by OCR. Check every amount against the paper before
                uploading — a misread digit would be matched as if it were true.
              </p>
            )}
            {framed !== null && (
              <p className={frameAgrees ? styles.ok : styles.warning}>
                {frameAgrees
                  ? 'Opening balance, plus deposits, less withdrawals, equals the closing balance. Nothing is missing.'
                  : `Opening balance, plus deposits, less withdrawals, comes to ${money(framed)} — the statement's closing balance is ${money(read.closingBalance ?? '0')}. A line is missing or misread.`}
              </p>
            )}
            {balanceIssues > 0 && (
              <p className={styles.warning}>
                {balanceIssues} line{balanceIssues === 1 ? '' : 's'} do not agree with the running
                balance on the statement. Check the amount on each one marked below.
              </p>
            )}

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={onlyProblems}
                onChange={(event) => setOnlyProblems(event.target.checked)}
              />
              Show only lines with something to check ({totals.issues})
            </label>

            <Table surface="card" density="tight" sticky className={styles.reviewTable}>
              <thead>
                <tr>
                  <th aria-label="Include" />
                  <th>Date</th>
                  <th>Description</th>
                  <th>Ref</th>
                  <th data-num>Withdrawal</th>
                  <th data-num>Deposit</th>
                  <th data-num>Balance</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((line) => (
                  <ReviewRow
                    key={line.key}
                    line={line}
                    onEdit={(patch) => editLine(line.key, patch)}
                    onAmount={(field, value) => settleAmount(line.key, field, value)}
                  />
                ))}
              </tbody>
            </Table>

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={reset} disabled={sending}>
                Start again
              </Button>
              {map && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep('map')}
                  disabled={sending}
                >
                  Back to columns
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void send()}
                disabled={sending || totals.count === 0}
              >
                {sending
                  ? 'Uploading…'
                  : `Upload ${totals.count} line${totals.count === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

interface ReviewRowProps {
  line: DraftLine;
  onEdit: (patch: Partial<DraftLine>) => void;
  onAmount: (field: 'withdrawal' | 'deposit', value: string) => void;
}

/** One line in the check step. Amounts are tidied when the field is left, not on every keystroke. */
function ReviewRow({ line, onEdit, onAmount }: ReviewRowProps) {
  const flagged = line.issues.length > 0;
  return (
    <>
      <tr className={cn(!line.include && styles.excluded, flagged && styles.flagged)}>
        <td>
          <input
            type="checkbox"
            aria-label="Include this line"
            checked={line.include}
            onChange={(event) => onEdit({ include: event.target.checked })}
          />
        </td>
        <td>
          <input
            type="date"
            className={styles.cellInput}
            aria-label="Date"
            value={line.txnDate}
            onChange={(event) => onEdit({ txnDate: event.target.value })}
          />
        </td>
        <td>
          <input
            className={cn(styles.cellInput, styles.wideCell)}
            aria-label="Description"
            value={line.description}
            onChange={(event) => onEdit({ description: event.target.value })}
          />
        </td>
        <td>
          <input
            className={styles.cellInput}
            aria-label="Reference"
            value={line.reference}
            onChange={(event) => onEdit({ reference: event.target.value })}
          />
        </td>
        <td data-num>
          <input
            key={`w-${line.withdrawal}`}
            className={cn(styles.cellInput, styles.amountCell)}
            aria-label="Withdrawal"
            inputMode="decimal"
            defaultValue={line.withdrawal}
            onBlur={(event) =>
              event.target.value !== line.withdrawal && onAmount('withdrawal', event.target.value)
            }
          />
        </td>
        <td data-num>
          <input
            key={`d-${line.deposit}`}
            className={cn(styles.cellInput, styles.amountCell)}
            aria-label="Deposit"
            inputMode="decimal"
            defaultValue={line.deposit}
            onBlur={(event) =>
              event.target.value !== line.deposit && onAmount('deposit', event.target.value)
            }
          />
        </td>
        <td data-num className={styles.balanceCell}>
          {line.balance || '—'}
        </td>
      </tr>
      {flagged && (
        <tr className={styles.issueRow}>
          <td />
          <td colSpan={6}>{line.issues.join(' · ')}</td>
        </tr>
      )}
    </>
  );
}
