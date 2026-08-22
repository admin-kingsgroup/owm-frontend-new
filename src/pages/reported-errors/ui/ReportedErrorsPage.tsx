import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { listClientErrors } from '@/entities/client-error';
import type { ClientError, ClientErrorKind } from '@/entities/client-error';
import { useStackedTables } from '@/shared/hooks';
import { Button, Select, Loading, EmptyState, Badge } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';
import { useButtonBar } from '@/widgets/app-shell';

import styles from './ReportedErrorsPage.module.css';

const PAGE_SIZE = 25;

/** A kind the server would accept — anything else in the URL is treated as "all". */
function isKind(value: string | null): value is ClientErrorKind {
  return value === 'RENDER' || value === 'UNHANDLED_REJECTION' || value === 'UNCAUGHT';
}

/** Plain words for the stored kind — the enum value is not what a person should read. */
const KIND_LABELS: Record<ClientErrorKind, string> = {
  RENDER: 'Screen failed to draw',
  UNHANDLED_REJECTION: 'Unhandled rejection',
  UNCAUGHT: 'Uncaught error',
};

/**
 * What the browser reported.
 *
 * Faults were being filed and read by nobody, which makes a diagnostic collection an expensive way
 * to store nothing. This is the other half: the reference a user was told to quote is the first
 * column, so a report of "it broke, here is the code" resolves to one record rather than a search.
 */
export function ReportedErrorsPage() {
  /**
   * Which page and which kind live in the URL, not in component state.
   *
   * It is the convention the rest of the shell already follows — a menu item links straight at a
   * screen in a particular state — and it is what makes "the render fault on page 3" something you
   * can send to somebody rather than describe to them.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = (isKind(searchParams.get('kind')) ? searchParams.get('kind') : '') as
    ClientErrorKind | '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const [errors, setErrors] = useState<ClientError[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  useStackedTables(pageRef);

  /** Writes one parameter and drops it when it is the default, so the URL stays readable. */
  const setParam = useCallback(
    (updates: Record<string, string>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(updates)) {
            if (value) next.set(name, value);
            else next.delete(name);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;

    // Inside the async function rather than the effect body: a synchronous setState in an effect
    // cascades a render before the request has even started. Same shape as the other list screens.
    async function load() {
      setLoading(true);

      try {
        const result = await listClientErrors({ page, limit: PAGE_SIZE, kind: kind || undefined });
        if (cancelled) return;
        setErrors(result.items);
        setTotal(result.total);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load reported errors'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [page, kind, refreshKey]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /*
    What this screen can do, printed down the right-hand side with the key that does it — the same
    way every other screen in the shell describes itself.
  */
  useButtonBar([
    {
      group: 'This list',
      key: 'F5',
      label: 'Refresh',
      onSelect: () => setRefreshKey((current) => current + 1),
      disabled: loading,
    },
    {
      group: 'This list',
      key: 'Alt+A',
      label: 'All kinds',
      onSelect: () => setParam({ kind: '', page: '' }),
      disabled: loading || kind === '',
    },
  ]);

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reported errors</h1>
          <p className={styles.subtitle}>
            Faults the app reported from someone&apos;s browser. Kept for 90 days, then dropped.
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <Select
          value={kind}
          aria-label="Filter by kind"
          onChange={(event) => setParam({ kind: event.target.value, page: '' })}
        >
          <option value="">All kinds</option>
          {(Object.keys(KIND_LABELS) as ClientErrorKind[]).map((value) => (
            <option key={value} value={value}>
              {KIND_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <Loading label="Loading reported errors…" />
      ) : errors.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={32} />}
          title="Nothing has been reported"
          description="A fault in anyone's browser is filed here automatically. An empty list is the good outcome."
        />
      ) : (
        <>
          <table className={styles.table} data-stack>
            <thead>
              <tr>
                <th>Reference</th>
                <th>When</th>
                <th>Kind</th>
                <th>Message</th>
                <th>Where</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((record) => (
                <tr
                  key={record.id}
                  className={styles.row}
                  /* The stack is the reason these are kept, but it is not what a list is for. */
                  onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                >
                  <td className={styles.mono}>{record.reference}</td>
                  <td>{new Date(record.createdAt).toLocaleString()}</td>
                  <td>
                    <Badge variant={record.kind === 'RENDER' ? 'danger' : 'neutral'}>
                      {KIND_LABELS[record.kind]}
                    </Badge>
                  </td>
                  <td className={styles.message}>{record.message}</td>
                  <td className={styles.mono}>{new URL(record.url).pathname}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {expanded && (
            <div className={styles.detail}>
              <p className={styles.detailTitle}>
                {errors.find((record) => record.id === expanded)?.reference}
              </p>
              <pre className={styles.stack}>
                {errors.find((record) => record.id === expanded)?.stack ?? 'No stack was captured.'}
              </pre>
              {errors.find((record) => record.id === expanded)?.componentStack && (
                <pre className={styles.stack}>
                  {errors.find((record) => record.id === expanded)?.componentStack}
                </pre>
              )}
            </div>
          )}

          <div className={styles.pager}>
            <span className={styles.pagerText}>
              Page {page} of {lastPage} · {total} reported
            </span>
            <div className={styles.pagerButtons}>
              <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setParam({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= lastPage}
                onClick={() => setParam({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
