import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react';

import {
  closeFinancialYear,
  createFinancialYear,
  deleteFinancialYear,
  listFinancialYears,
  reopenFinancialYear,
} from '@/entities/financial-year';
import type { FinancialYear } from '@/entities/financial-year';
import {
  Badge,
  Button,
  Input,
  Loading,
  Table,
  IconButton,
  IconButtonGroup,
  ConfirmDialog,
  toast,
} from '@/shared/ui';
import { getErrorMessage, toCalendarDay } from '@/shared/lib';

import styles from './FinancialYearsPanel.module.css';

export interface FinancialYearsPanelProps {
  companyId: string;
}

/** The day after the last year ends — the natural start for the next one. */
function nextYearRange(years: FinancialYear[]): { start: string; end: string } {
  const last = years[years.length - 1];
  if (!last) return { start: '', end: '' };

  const start = new Date(last.endDate);
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(end.getUTCDate() - 1);

  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Financial years are their own records, not a field on the company — which is what lets a company
 * roll into its next year and accept back-dated entry into earlier ones. Closing a year is the
 * period lock: nothing new can be filed into it afterwards.
 */
export function FinancialYearsPanel({ companyId }: FinancialYearsPanelProps) {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The year waiting on a yes. */
  const [pendingDelete, setPendingDelete] = useState<FinancialYear | null>(null);

  const [adding, setAdding] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await listFinancialYears(companyId);
        if (!cancelled) setYears(result);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load financial years'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  function startAdding() {
    const suggested = nextYearRange(years);
    setStartDate(suggested.start);
    setEndDate(suggested.end);
    setAdding(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createFinancialYear(companyId, { startDate, endDate });
      setYears((current) =>
        [...current, created].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      setAdding(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create financial year'));
    } finally {
      setSubmitting(false);
    }
  }

  async function runOn(id: string, action: () => Promise<FinancialYear>) {
    setBusyId(id);
    setError(null);
    try {
      const updated = await action();
      setYears((current) => current.map((year) => (year.id === id ? updated : year)));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update financial year'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const year = pendingDelete;

    setBusyId(year.id);
    setError(null);
    try {
      await deleteFinancialYear(companyId, year.id);
      setYears((current) => current.filter((entry) => entry.id !== year.id));
      setPendingDelete(null);
      toast.success(`Financial year ${year.label} deleted.`);
    } catch (err) {
      /* The dialog stays open, still naming the year that is still in the list. */
      toast.error(getErrorMessage(err, 'Could not delete financial year'));
    } finally {
      setBusyId(null);
    }
  }

  /*
    Rendered both while the years are loading and once they are — see CurrenciesPanel, which sits
    beside this one and had the same hole.
  */
  const head = (
    <div className={styles.head}>
      <div>
        <h2 className={styles.title}>Financial years</h2>
        <p className={styles.hint}>
          Vouchers are filed into the year covering their date. Closing a year locks it — nothing
          new can be posted into it afterwards.
        </p>
      </div>
      {!loading && !adding && (
        <Button variant="secondary" onClick={startAdding}>
          <Plus size={14} /> New year
        </Button>
      )}
    </div>
  );

  if (loading)
    return (
      <div className={styles.panel}>
        {head}
        <Loading label="Loading financial years…" />
      </div>
    );

  return (
    <div className={styles.panel}>
      {head}

      {error && <p className={styles.error}>{error}</p>}

      {adding && (
        <form className={styles.form} onSubmit={handleCreate}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fy-start">
              Starts
            </label>
            <Input
              id="fy-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fy-end">
              Ends
            </label>
            <Input
              id="fy-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </div>
          <div className={styles.formActions}>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Table surface="plain" stack>
        <thead>
          <tr>
            <th>Year</th>
            <th>Starts</th>
            <th>Ends</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year.id}>
              <td>{year.label}</td>
              <td>{toCalendarDay(year.startDate)}</td>
              <td>{toCalendarDay(year.endDate)}</td>
              <td>
                <Badge variant={year.status === 'OPEN' ? 'success' : 'neutral'}>
                  {year.status}
                </Badge>
              </td>
              <td>
                <IconButtonGroup>
                  {year.status === 'OPEN' ? (
                    <IconButton
                      label={`Close financial year ${year.label}`}
                      disabled={busyId === year.id}
                      onClick={() => runOn(year.id, () => closeFinancialYear(companyId, year.id))}
                    >
                      <Lock size={13} />
                    </IconButton>
                  ) : (
                    <IconButton
                      label={`Reopen financial year ${year.label}`}
                      disabled={busyId === year.id}
                      onClick={() => runOn(year.id, () => reopenFinancialYear(companyId, year.id))}
                    >
                      <LockOpen size={13} />
                    </IconButton>
                  )}
                  <IconButton
                    label={`Delete financial year ${year.label}`}
                    variant="danger"
                    disabled={busyId === year.id}
                    onClick={() => setPendingDelete(year)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </IconButtonGroup>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/*
        Replaces window.confirm(). A financial year is the thing every voucher is filed into, so
        the consequence is worth stating rather than leaving to "This can't be undone."
      */}
      {pendingDelete && (
        <ConfirmDialog
          open
          destructive
          busy={busyId === pendingDelete.id}
          title={`Delete financial year ${pendingDelete.label}?`}
          consequence="This cannot be undone."
          confirmLabel="Delete year"
          cancelLabel="Keep"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        >
          Vouchers are filed into the year covering their date. A year holding vouchers cannot be
          deleted.
        </ConfirmDialog>
      )}
    </div>
  );
}
