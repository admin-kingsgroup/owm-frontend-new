import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Ban, Check, Link2, Pencil, Plus, Trash2 } from 'lucide-react';

import type { AuditList } from '@/entities/report';
import { useAuthStore } from '@/features/auth';
import { cn } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface AuditTrailViewProps {
  trail: AuditList;
  /** Writes a date the way the company's country writes it. */
  day: (value: string) => string;
}

type Entry = AuditList['rows'][number];

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

/** The mark beside each entry, and the colour it is drawn in — one per kind of change. */
const ACTION_MARKS: Record<string, { icon: ReactNode; tone: string }> = {
  CREATE: { icon: <Plus size={13} />, tone: styles.auditMade },
  POST: { icon: <Check size={13} />, tone: styles.auditMade },
  UPDATE: { icon: <Pencil size={12} />, tone: styles.auditChanged },
  RECONCILE: { icon: <Link2 size={13} />, tone: styles.auditChanged },
  CANCEL: { icon: <Ban size={13} />, tone: styles.auditRemoved },
  DELETE: { icon: <Trash2 size={12} />, tone: styles.auditRemoved },
};

/** The filters across the top, each a set of actions. */
const FILTERS = [
  { id: 'all', label: 'Everything', actions: null },
  { id: 'made', label: 'Entered & posted', actions: ['CREATE', 'POST'] },
  { id: 'changed', label: 'Changes', actions: ['UPDATE', 'RECONCILE'] },
  { id: 'removed', label: 'Removed & cancelled', actions: ['DELETE', 'CANCEL'] },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

/** A recorded value as text. Objects are rare here, and shown as written rather than dropped. */
function show(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Each field a change touched: what it was, and what it is now. */
function changes(entry: Entry) {
  if (!entry.after) return [];
  return Object.keys(entry.after).map((key) => ({
    key,
    before: entry.before && key in entry.before ? show(entry.before[key]) : null,
    after: show(entry.after?.[key]),
  }));
}

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * Who changed what, and when.
 *
 * Newest first, because the question that brings anyone here is almost always about something that
 * has just happened — and grouped by the day it happened, which is how that question is asked.
 * Read-only by construction: the trail is written by the services that change the books and there
 * is no endpoint that edits or removes an entry, which is what makes it worth anything at all.
 */
export function AuditTrailView({ trail, day }: AuditTrailViewProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const me = useAuthStore((state) => state.user);

  const matches = (entry: Entry, id: FilterId) => {
    const actions = FILTERS.find((f) => f.id === id)?.actions;
    return !actions || (actions as readonly string[]).includes(entry.action);
  };
  const shown = trail.rows.filter((entry) => matches(entry, filter));

  // Days in the order the entries arrive, which is newest first.
  const days = shown.reduce<Array<{ label: string; entries: Entry[] }>>((list, entry) => {
    const label = day(entry.at);
    const last = list[list.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else list.push({ label, entries: [entry] });
    return list;
  }, []);

  /** Who made the change, as far as the record says. An id is no use to a reader; "you" is. */
  const who = (entry: Entry) =>
    entry.userId === null ? 'the system' : me && entry.userId === me.id ? 'you' : 'another user';

  return (
    <section className={cn(styles.panel, styles.auditPanel)}>
      <p className={styles.hint}>
        Every change to a voucher or a master, recorded as it happened. Entries cannot be edited or
        removed — a correction is itself recorded, rather than replacing what it corrects.
      </p>

      <div className={styles.auditFilters} role="group" aria-label="Show">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cn(styles.auditFilter, filter === option.id && styles.auditFilterOn)}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
            <span className={styles.auditCount}>
              {trail.rows.filter((entry) => matches(entry, option.id)).length}
            </span>
          </button>
        ))}
      </div>

      {trail.rows.length === 0 && (
        <p className={styles.empty}>Nothing has been changed in this period.</p>
      )}
      {trail.rows.length > 0 && shown.length === 0 && (
        <p className={styles.empty}>Nothing of this kind in the entries shown.</p>
      )}

      {days.map((group) => (
        <div key={group.label} className={styles.auditDay}>
          <h3 className={styles.auditDayTitle}>{group.label}</h3>
          <ol className={styles.timeline}>
            {group.entries.map((entry, i) => {
              const mark = ACTION_MARKS[entry.action] ?? ACTION_MARKS.UPDATE;
              const fields = changes(entry);
              return (
                <li
                  key={entry.id}
                  className={styles.timelineItem}
                  style={{ '--i': Math.min(i, 12) } as CSSProperties}
                >
                  <span className={cn(styles.timelineMark, mark.tone)} aria-hidden="true">
                    {mark.icon}
                  </span>
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineHead}>
                      <b>
                        {ACTION_LABELS[entry.action] ?? entry.action}{' '}
                        {(ENTITY_LABELS[entry.entity] ?? entry.entity).toLowerCase()}
                      </b>
                      <span className={styles.timelineSummary}>{entry.summary}</span>
                    </div>
                    <span className={styles.timelineMeta}>
                      <time dateTime={entry.at}>{clock.format(new Date(entry.at))}</time> · by{' '}
                      {who(entry)}
                    </span>
                    {fields.length > 0 && (
                      <dl className={styles.diff}>
                        {fields.map((field) => (
                          <div key={field.key} className={styles.diffRow}>
                            <dt>{field.key}</dt>
                            <dd>
                              {field.before !== null && (
                                <>
                                  <del>{field.before}</del>
                                  <ArrowRight size={12} aria-label="became" />
                                </>
                              )}
                              <ins>{field.after}</ins>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      {trail.total > trail.rows.length && (
        <p className={styles.hint}>
          Showing the {trail.rows.length} most recent of {trail.total}. The trail is ordered by when
          a change was made, which is not the period the reports are showing, so it is not narrowed
          by one.
        </p>
      )}
    </section>
  );
}
