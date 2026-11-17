import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, ScanText } from 'lucide-react';

import {
  OCR_ACCEPT,
  checkOcrFile,
  compareOcrProviders,
  extractDocument,
  formatFileSize,
  getOcrProviders,
  ocrFileType,
  ocrTypeName,
} from '@/entities/ocr';
import type { OcrComparison, OcrProviderId, OcrProviders, OcrResult } from '@/entities/ocr';
import { getErrorMessage, getErrorStatus } from '@/shared/lib';
import { Button, Checkbox, EmptyState, PageSkeleton, Panel, Select } from '@/shared/ui';

import { OcrComparisonView } from './OcrComparisonView';
import { OcrResultView } from './OcrResultView';
import styles from './OcrTestPage.module.css';

/** The mode select: one provider, or every provider on the same file. */
type Mode = OcrProviderId | 'compare';

type Outcome =
  { kind: 'single'; result: OcrResult } | { kind: 'compare'; comparison: OcrComparison };

interface Selected {
  file: File;
  /** An object URL for the preview. Revoked when it is replaced and when the page closes. */
  url: string;
}

/** The provider to start on: the server's default when it can run, else the first that can. */
function initialMode(info: OcrProviders): Mode {
  const usable = info.providers.filter((provider) => provider.configured);
  const preferred = usable.find((provider) => provider.id === info.default_provider);
  return (preferred ?? usable[0])?.id ?? 'compare';
}

/**
 * OCR test bench: upload a document, read it with one provider or all of them, and see the text and
 * the structured fields that came back.
 *
 * A testing tool, not a feature. The server only allows it when OCR_ENABLED is set, and only for
 * administrators, because every run sends the document to a third party.
 */
export function OcrTestPage() {
  const [info, setInfo] = useState<OcrProviders | null>(null);
  const [loadFailure, setLoadFailure] = useState<{ message: string; refused: boolean } | null>(
    null,
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const [selected, setSelected] = useState<Selected | null>(null);
  const [mode, setMode] = useState<Mode>('compare');
  const [structured, setStructured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const previewUrl = useRef<string | null>(null);
  const fileId = useId();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getOcrProviders();
        if (cancelled) return;
        setInfo(result);
        setMode(initialMode(result));
        setLoadFailure(null);
      } catch (err) {
        if (cancelled) return;
        const status = getErrorStatus(err);
        setLoadFailure({
          message: getErrorMessage(err, 'Could not load the OCR settings'),
          refused: status === 401 || status === 403,
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // The preview's object URL holds the whole file in memory until it is revoked.
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function choose(file: File | undefined) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setOutcome(null);
    setError(null);

    if (!file) {
      setSelected(null);
      return;
    }

    const url = URL.createObjectURL(file);
    previewUrl.current = url;
    setSelected({ file, url });
  }

  const provider =
    mode === 'compare' ? undefined : info?.providers.find((entry) => entry.id === mode);
  const problem =
    selected && info ? checkOcrFile(selected.file, info.max_file_size_bytes, provider) : null;

  async function run() {
    if (!selected || !info || problem) return;

    setBusy(true);
    setError(null);
    setOutcome(null);

    try {
      if (mode === 'compare') {
        setOutcome({
          kind: 'compare',
          comparison: await compareOcrProviders(selected.file, structured),
        });
      } else {
        setOutcome({
          kind: 'single',
          result: await extractDocument(selected.file, { provider: mode, structured }),
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read that document'));
    } finally {
      setBusy(false);
    }
  }

  if (loadFailure) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<AlertTriangle size={32} />}
          title={
            loadFailure.refused
              ? 'Only an administrator can run OCR tests'
              : 'Could not open OCR testing'
          }
          description={loadFailure.message}
          action={
            loadFailure.refused ? (
              <Link to="/companies">
                <Button variant="primary">Back to the companies</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={() => setRefreshKey((current) => current + 1)}>
                Try again
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (!info) {
    return <PageSkeleton variant="rows" label="Loading OCR settings…" />;
  }

  const labels = Object.fromEntries(
    info.providers.map((entry) => [entry.id, entry.label]),
  ) as Record<OcrProviderId, string>;
  const anyConfigured = info.providers.some((entry) => entry.configured);
  const fileType = selected ? ocrFileType(selected.file) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>OCR test</h1>
          <p className={styles.subtitle}>
            Read text from an image or PDF with an external OCR provider, and compare providers on
            the same document.
          </p>
        </div>
      </div>

      <p className={styles.notice} role="note">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          For testing only. Each run sends the file to the provider you choose (OCR.space or xAI).
          Do not upload production or confidential documents unless that has been approved. Nothing
          is stored on this server.
        </span>
      </p>

      {!info.enabled ? (
        <EmptyState
          icon={<ScanText size={32} />}
          title="OCR testing is turned off on this server"
          description="An administrator can turn it on by setting OCR_ENABLED=true in the backend's environment and restarting it. See OCR_INTEGRATION.md in the backend repository."
        />
      ) : !anyConfigured ? (
        <EmptyState
          icon={<ScanText size={32} />}
          title="No OCR provider is configured"
          description="Set OCR_SPACE_API_KEY and/or XAI_API_KEY in the backend's environment and restart it."
        />
      ) : (
        <div className={styles.workspace}>
          <div className={styles.side}>
            <Panel title="Document">
              <div className={styles.controls}>
                <div className={styles.field}>
                  <label htmlFor={fileId} className={styles.fieldLabel}>
                    File
                  </label>
                  <input
                    id={fileId}
                    type="file"
                    accept={OCR_ACCEPT}
                    aria-describedby={`${fileId}-hint`}
                    onChange={(event) => choose(event.target.files?.[0])}
                    disabled={busy}
                  />
                  <span id={`${fileId}-hint`} className={styles.hint}>
                    JPG, PNG or PDF, up to {formatFileSize(info.max_file_size_bytes)}.
                  </span>
                </div>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Provider</span>
                  <Select
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as Mode);
                      setOutcome(null);
                      setError(null);
                    }}
                    disabled={busy}
                  >
                    {info.providers.map((entry) => (
                      <option key={entry.id} value={entry.id} disabled={!entry.configured}>
                        {entry.label}
                        {entry.configured ? '' : ' (not configured)'}
                      </option>
                    ))}
                    <option value="compare">Compare all providers</option>
                  </Select>
                </label>

                <Checkbox
                  label="Structured JSON"
                  hint="Classify the document and pull out its fields, as well as the text."
                  checked={structured}
                  onChange={(event) => setStructured(event.target.checked)}
                  disabled={busy}
                />

                {problem && (
                  <p className={styles.error} role="alert">
                    {problem}
                  </p>
                )}

                <Button
                  variant="primary"
                  onClick={run}
                  disabled={!selected || Boolean(problem) || busy}
                >
                  <ScanText size={16} aria-hidden="true" />
                  {busy ? 'Reading…' : mode === 'compare' ? 'Compare providers' : 'Read document'}
                </Button>
              </div>

              {provider && provider.notes.length > 0 && (
                <ul className={styles.notes} aria-label={`About ${provider.label}`}>
                  {provider.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </Panel>

            {selected && (
              <Panel title="Uploaded document">
                <p className={styles.meta}>
                  {selected.file.name} · {fileType ? ocrTypeName(fileType) : 'unknown type'} ·{' '}
                  {formatFileSize(selected.file.size)}
                </p>
                {fileType === 'application/pdf' ? (
                  <object
                    className={styles.preview}
                    data={selected.url}
                    type="application/pdf"
                    aria-label="Uploaded PDF preview"
                  >
                    <p className={styles.muted}>
                      <FileText size={16} aria-hidden="true" /> This browser cannot show PDFs
                      inline.{' '}
                      <a href={selected.url} target="_blank" rel="noreferrer">
                        Open it
                      </a>
                      .
                    </p>
                  </object>
                ) : fileType ? (
                  <img
                    className={styles.preview}
                    src={selected.url}
                    alt="Uploaded document preview"
                  />
                ) : null}
              </Panel>
            )}
          </div>

          <div className={styles.main} aria-live="polite" aria-busy={busy}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            {busy ? (
              <PageSkeleton variant="rows" label="Reading the document…" />
            ) : outcome?.kind === 'single' ? (
              <OcrResultView result={outcome.result} label={labels[outcome.result.provider]} />
            ) : outcome?.kind === 'compare' ? (
              <OcrComparisonView comparison={outcome.comparison} labels={labels} />
            ) : (
              !error && (
                <EmptyState
                  icon={<ScanText size={32} />}
                  title="No document read yet"
                  description="Choose a file and a provider, then read it. Try a few kinds: a clean scan, a phone photo, a faint or skewed page, a multi-page PDF."
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
