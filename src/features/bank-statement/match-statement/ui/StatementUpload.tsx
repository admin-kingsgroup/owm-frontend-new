import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import {
  checkOcrFile,
  fitImageForOcr,
  formatFileSize,
  getOcrProviders,
  ocrFileType,
} from '@/entities/ocr';
import type { OcrProviderId, OcrProviderInfo, OcrProviders } from '@/entities/ocr';
import { cn, getErrorMessage } from '@/shared/lib';
import { Badge, Button, Select, Table } from '@/shared/ui';

import { matchBankStatement } from '../../api/bank-statement-api';
import type {
  BankStatementMatch,
  ConfirmedMatch,
  ReconcileOutcome,
  StatementLine,
} from '../../model/types';

import styles from './StatementUpload.module.css';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export interface StatementUploadProps {
  companyId: string;
  ledgerId: string;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
  /** What a voucher type is called, given its code. */
  typeName: (code: string) => string;
  /** Reconciles the confirmed lines on their statement dates and re-reads the report. */
  onReconcile: (matches: ConfirmedMatch[]) => Promise<ReconcileOutcome>;
}

type Stage = 'idle' | 'preparing' | 'reading' | 'saving';

/** The provider for this file: the one chosen, unless it cannot read this kind of file. */
function providerFor(
  info: OcrProviders,
  chosen: OcrProviderId | '',
  isPdf: boolean,
): OcrProviderInfo | null {
  const usable = info.providers.filter((provider) => provider.configured);
  const preferred = usable.find((provider) => provider.id === chosen) ?? usable[0];
  if (!preferred) return null;
  if (!isPdf || preferred.accepted_types.includes('application/pdf')) return preferred;
  return usable.find((provider) => provider.accepted_types.includes('application/pdf')) ?? null;
}

/**
 * Which column a line's amount goes in: the statement's own, or — when it could not be read — the
 * one the matched book line implies. Null for an unmatched line whose direction was not read.
 */
function sideOf(line: StatementLine): 'withdrawal' | 'deposit' | null {
  return line.direction ?? line.match?.direction ?? null;
}

/**
 * Upload a bank statement in the Bank Reconciliation tab and confirm what it matches.
 *
 * Reading suggests; it never reconciles. Matches the server is sure of start ticked, the ones worth
 * a second look start unticked, and nothing changes in the books until "Reconcile selected" —
 * which goes through the same reconcile call, on the bank's own dates, as typing them in by hand.
 */
export function StatementUpload({
  companyId,
  ledgerId,
  money,
  day,
  typeName,
  onReconcile,
}: StatementUploadProps) {
  const [info, setInfo] = useState<OcrProviders | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [provider, setProvider] = useState<OcrProviderId | ''>('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<BankStatementMatch | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const providers = await getOcrProviders();
        if (cancelled) return;
        setInfo(providers);
        setProvider(
          providers.providers.find(
            (entry) => entry.configured && entry.id === providers.default_provider,
          )?.id ??
            providers.providers.find((entry) => entry.configured)?.id ??
            '',
        );
        if (!providers.enabled) {
          setUnavailable(
            'Statement upload is turned off on this server. An administrator can turn it on with OCR_ENABLED=true.',
          );
        } else if (!providers.providers.some((entry) => entry.configured)) {
          setUnavailable(
            'Statement upload needs an OCR provider key on the server (OCR_SPACE_API_KEY or XAI_API_KEY).',
          );
        }
      } catch (err) {
        if (!cancelled) setUnavailable(getErrorMessage(err, 'Statement upload is not available.'));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = stage !== 'idle';
  const configured = info?.providers.filter((entry) => entry.configured) ?? [];
  const reader = info ? providerFor(info, provider, false) : null;

  async function read(file: File) {
    if (!info) return;

    setError(null);
    setNotice(null);
    setResult(null);
    setDone(new Set());
    setFileName(file.name);

    const isPdf = ocrFileType(file) === 'application/pdf';
    const use = providerFor(info, provider, isPdf);

    if (!use) {
      setError(
        'None of the configured OCR providers reads PDFs. Upload a photo of the statement instead.',
      );
      return;
    }

    const limit = Math.min(info.max_file_size_bytes, use.max_file_size_bytes);

    setStage('preparing');
    let upload: File;
    try {
      upload = await fitImageForOcr(file, limit);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not prepare that photo.'));
      setStage('idle');
      return;
    }

    const problem = checkOcrFile(upload, info.max_file_size_bytes, use);
    if (problem) {
      setError(
        isPdf
          ? `${problem} Download a shorter date range from the bank, or upload a photo of each page.`
          : problem,
      );
      setStage('idle');
      return;
    }

    setStage('reading');
    try {
      const matched = await matchBankStatement(companyId, ledgerId, upload, use.id);
      setResult(matched);
      // Sure matches start ticked; the ones to check do not.
      setSelected(
        new Set(
          matched.lines
            .filter((line) => line.match?.strength === 'strong')
            .map((line) => line.index),
        ),
      );
      if (use.id !== provider && isPdf) {
        setNotice(`PDFs are read with ${use.label}.`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read that statement'));
    } finally {
      setStage('idle');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function reconcileSelected() {
    if (!result) return;

    const confirmed = result.lines
      .filter((line) => line.match && line.bankDate && selected.has(line.index))
      .filter((line) => !done.has(line.match!.entryId))
      .map((line) => ({
        voucherId: line.match!.voucherId,
        entryId: line.match!.entryId,
        bankDate: line.bankDate!,
      }));

    if (confirmed.length === 0) return;

    setStage('saving');
    setError(null);
    setNotice(null);

    try {
      const outcome = await onReconcile(confirmed);
      setDone((current) => new Set([...current, ...outcome.reconciled]));
      setSelected(new Set());

      if (outcome.reconciled.length > 0) {
        setNotice(
          `Reconciled ${outcome.reconciled.length} line${outcome.reconciled.length === 1 ? '' : 's'} on the dates the bank showed them.`,
        );
      }
      if (outcome.failed.length > 0) {
        setError(`${outcome.failed.length} could not be reconciled: ${outcome.failed[0].message}`);
      }
    } finally {
      setStage('idle');
    }
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (unavailable) {
    return <p className={styles.unavailable}>{unavailable}</p>;
  }

  if (!info) return null;

  const suggestions =
    result?.lines.filter((line) => line.match && !done.has(line.match.entryId)) ?? [];
  const unmatched = result?.lines.filter((line) => !line.match) ?? [];
  const ticked = suggestions.filter((line) => selected.has(line.index)).length;

  const amountCells = (line: StatementLine) => {
    const side = sideOf(line);
    return (
      <>
        <td data-num>{line.amount && side === 'withdrawal' ? money(line.amount) : ''}</td>
        <td data-num>{line.amount && side === 'deposit' ? money(line.amount) : ''}</td>
      </>
    );
  };

  /** The statement's narration, with its amount spelled out when no column could take it. */
  const statementCell = (line: StatementLine) => (
    <td data-wrap>
      {line.description ?? '—'}
      {line.reference && <span className={styles.sub}>Ref {line.reference}</span>}
      {line.amount && !sideOf(line) && (
        <span className={styles.sub}>{money(line.amount)}, direction not read</span>
      )}
    </td>
  );

  return (
    <section className={styles.box} aria-label="Match a bank statement">
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Match a bank statement</h3>
          <p className={styles.hint}>
            Upload the bank&rsquo;s PDF or a photo of the statement. Each line is matched to an open
            entry below; nothing is reconciled until you confirm.
          </p>
        </div>

        <div className={styles.actions}>
          {configured.length > 1 && (
            <Select
              aria-label="Read the statement with"
              value={provider}
              disabled={busy}
              onChange={(event) => setProvider(event.target.value as OcrProviderId)}
            >
              {configured.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className={styles.file}
            aria-label="Bank statement file"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
            }}
          />
          <Button
            variant="primary"
            className={styles.upload}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            {stage === 'preparing'
              ? 'Preparing…'
              : stage === 'reading'
                ? 'Reading…'
                : result
                  ? 'Upload another'
                  : 'Upload statement'}
          </Button>
        </div>
      </div>

      <p className={styles.privacy}>
        The statement is sent to {reader?.label ?? 'the OCR provider'} to be read
        {reader?.id === 'ocr_space'
          ? ` (up to ${formatFileSize(reader.max_file_size_bytes)}, 3 PDF pages on the free plan)`
          : ''}
        . Testing feature: upload only statements you are allowed to share with it.
      </p>

      {stage === 'reading' && (
        <p className={styles.progress} role="status">
          Reading {fileName}… this can take up to a minute.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {result && (
        <div className={styles.results}>
          <p className={styles.summary}>
            {fileName} · {result.summary.lines} line{result.summary.lines === 1 ? '' : 's'} read ·{' '}
            {result.summary.matched} matched ({result.summary.strong} sure,{' '}
            {result.summary.possible} to check) · {result.summary.unmatched} not in the books
          </p>

          {result.warnings.length > 0 && (
            <ul className={styles.warnings} aria-label="Warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {suggestions.length > 0 && (
            <>
              <h4 className={styles.subheading}>Suggested matches</h4>
              <Table surface="plain" stack zebra={false} tableClassName={styles.grid}>
                <thead>
                  <tr>
                    <th>Sr No</th>
                    <th>Reconcile</th>
                    <th>Bank date</th>
                    <th>On the statement</th>
                    <th>Withdrawal</th>
                    <th>Deposit</th>
                    <th>Voucher</th>
                    <th>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((line, position) => {
                    const match = line.match!;
                    return (
                      <tr key={line.index}>
                        <td data-num>{position + 1}</td>
                        <td>
                          <input
                            type="checkbox"
                            className={styles.tick}
                            checked={selected.has(line.index)}
                            disabled={busy}
                            aria-label={`Reconcile ${match.voucherNumber} on ${line.bankDate}`}
                            onChange={() => toggle(line.index)}
                          />
                        </td>
                        <td>{line.bankDate ? day(line.bankDate) : '—'}</td>
                        {statementCell(line)}
                        {amountCells(line)}
                        <td data-wrap>
                          {match.voucherNumber} · {typeName(match.voucherTypeCode)}
                          <span className={styles.sub}>
                            {day(match.voucherDate)}
                            {match.narration ? ` · ${match.narration}` : ''}
                          </span>
                        </td>
                        <td data-wrap>
                          <Badge variant={match.strength === 'strong' ? 'success' : 'warning'}>
                            {match.strength === 'strong' ? 'Sure' : 'Check'}
                          </Badge>
                          <span className={styles.sub}>{match.reasons.join(' · ')}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className={styles.confirm}>
                <Button
                  variant="primary"
                  disabled={busy || ticked === 0}
                  onClick={() => void reconcileSelected()}
                >
                  {stage === 'saving' ? 'Reconciling…' : `Reconcile ${ticked} selected`}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setSelected(new Set(suggestions.map((line) => line.index)))}
                >
                  Select all
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setResult(null)}>
                  Discard
                </Button>
              </div>
            </>
          )}

          {unmatched.length > 0 && (
            <>
              <h4 className={styles.subheading}>On the statement, not open in the books</h4>
              <Table surface="plain" stack zebra={false} tableClassName={styles.grid}>
                <thead>
                  <tr>
                    <th>Sr No</th>
                    <th>Bank date</th>
                    <th>On the statement</th>
                    <th>Withdrawal</th>
                    <th>Deposit</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((line, position) => (
                    <tr key={line.index}>
                      <td data-num>{position + 1}</td>
                      <td>{line.bankDate ? day(line.bankDate) : (line.date ?? '—')}</td>
                      {statementCell(line)}
                      {amountCells(line)}
                      <td data-wrap className={cn(styles.sub, styles.why)}>
                        {line.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </div>
      )}
    </section>
  );
}
