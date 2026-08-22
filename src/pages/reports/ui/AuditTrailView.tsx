import type { AuditList } from '@/entities/report';
import { toCalendarDay } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface AuditTrailViewProps {
  trail: AuditList;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Entered',
  UPDATE: 'Changed',
  DELETE: 'Removed',
  POST: 'Posted',
  CANCEL: 'Cancelled',
  RECONCILE: 'Reconciled',
};

const ENTITY_LABELS: Record<string, string> = {
  VOUCHER: 'Voucher',
  LEDGER: 'Ledger',
  ACCOUNT_GROUP: 'Group',
  VOUCHER_TYPE: 'Voucher type',
  FINANCIAL_YEAR: 'Financial year',
};

/** "narration: was → is now", or nothing when a record carries no before-and-after. */
function describeChange(entry: AuditList['rows'][number]): string | null {
  if (!entry.after) return null;

  return Object.keys(entry.after)
    .map((key) => `${key}: ${String(entry.before?.[key] ?? '—')} → ${String(entry.after?.[key])}`)
    .join(' · ');
}

/**
 * Who changed what, and when.
 *
 * Newest first, because the question that brings anyone here is almost always about something that
 * has just happened. Read-only by construction — the trail is written by the services that change
 * the books and there is no endpoint that edits or removes an entry, which is what makes it worth
 * anything at all.
 */
export function AuditTrailView({ trail }: AuditTrailViewProps) {
  return (
    <section className={styles.panel}>
      <p className={styles.hint}>
        Every change to a voucher or a master, recorded as it happened. Entries cannot be edited or
        removed — a correction is itself recorded, rather than replacing what it corrects.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table} data-stack>
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Action</th>
              <th>Summary</th>
              <th>Changed</th>
            </tr>
          </thead>
          <tbody>
            {trail.rows.map((entry) => (
              <tr key={entry.id}>
                <td>{toCalendarDay(entry.at)}</td>
                <td>{ENTITY_LABELS[entry.entity] ?? entry.entity}</td>
                <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
                <td>{entry.summary}</td>
                <td>{describeChange(entry) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trail.rows.length === 0 && (
        <p className={styles.empty}>Nothing has been changed in this period.</p>
      )}

      {trail.total > trail.rows.length && (
        <p className={styles.hint}>
          Showing the {trail.rows.length} most recent of {trail.total}. Narrow the period to see
          further back.
        </p>
      )}
    </section>
  );
}
