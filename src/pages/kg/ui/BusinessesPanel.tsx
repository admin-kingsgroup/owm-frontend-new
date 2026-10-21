import { Fragment, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Trash2, Download, ChevronRight, ChevronDown, Lock, Plus } from 'lucide-react';

import {
  createBusiness,
  deleteBusiness,
  fetchTemplate,
  listBusinesses,
  listSnapshots,
} from '@/entities/kg';
import type { Business, Partner, Snapshot } from '@/entities/kg';
import {
  Button,
  Input,
  Select,
  Badge,
  EmptyState,
  Table,
  IconButton,
  ConfirmDialog,
  toast,
} from '@/shared/ui';
import { cn, getErrorMessage } from '@/shared/lib';

import { BusinessWorkspace } from './BusinessWorkspace';
import styles from './KgPage.module.css';

export interface BusinessesPanelProps {
  companyId: string;
  businesses: Business[];
  partners: Partner[];
  /** The portfolio's country and currency, for the figures in an opened business. */
  country: string;
  portfolioCurrency: string;
  onChanged: (businesses: Business[]) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
);

interface ShareRow {
  partnerId: string;
  percent: string;
}

/**
 * The businesses KG measures. They are **external** — not OWM companies — and report their own
 * figures each month.
 *
 * The share editor totals as you type. Shares must come to exactly 100, and the server refuses
 * anything else; showing the running total means that refusal is never a surprise.
 */
export function BusinessesPanel({
  companyId,
  businesses,
  partners,
  country,
  portfolioCurrency,
  onChanged,
}: BusinessesPanelProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which business's month-end workspace is open. One at a time — they are long. */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Removing a business, in up to two questions.
   *
   * `pendingDelete` is the ordinary ask. `pendingForce` is the second one, and only appears when
   * the server has refused because the business has already reported figures — it is a different
   * question with a much larger consequence, so it is asked separately rather than folded into the
   * first as a paragraph of small print.
   */
  const [pendingDelete, setPendingDelete] = useState<Business | null>(null);
  const [pendingForce, setPendingForce] = useState<Business | null>(null);
  const [removing, setRemoving] = useState(false);

  /** Every business's snapshots, for the grid of months reported. Keyed by business. */
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [gridYear] = useState(() => new Date().getUTCFullYear());

  const loadSnapshots = useCallback(async () => {
    const results = await Promise.allSettled(
      businesses.map((business) => listSnapshots(companyId, business.id)),
    );
    return Object.fromEntries(
      results.map((result, i) => [
        businesses[i].id,
        result.status === 'fulfilled' ? result.value : [],
      ]),
    );
  }, [companyId, businesses]);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshots().then((result) => {
      if (!cancelled) setSnapshots(result);
    });
    return () => {
      cancelled = true;
    };
  }, [loadSnapshots]);

  const total = shares.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
  const sharesValid = shares.length === 0 || Math.abs(total - 100) < 0.005;

  function addShare() {
    const unused = partners.find((partner) => !shares.some((row) => row.partnerId === partner.id));
    if (unused) setShares([...shares, { partnerId: unused.id, percent: '' }]);
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createBusiness(companyId, {
        code,
        name,
        reportingCurrency: currency,
        partners: shares.length
          ? shares.map((row) => ({
              partnerId: row.partnerId,
              profitSharePercent: Number(row.percent),
            }))
          : undefined,
      });
      onChanged(await listBusinesses(companyId));
      setCode('');
      setName('');
      setShares([]);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add business'));
    } finally {
      setBusy(false);
    }
  }

  /** The ordinary removal. A business that has reported is refused, and asks the second question. */
  async function handleDelete() {
    if (!pendingDelete) return;
    const business = pendingDelete;

    setError(null);
    setRemoving(true);
    try {
      await deleteBusiness(companyId, business.id);
      onChanged(await listBusinesses(companyId));
      setPendingDelete(null);
      toast.success(`${business.name} removed.`);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not remove business');

      /*
        The server refuses a business that has reported, and says so. For one created by mistake
        that refusal is a dead end, so the way out is offered — but as a second, deliberate
        confirmation naming what is destroyed, never as a silent retry.
      */
      if (message.includes('force=true')) {
        setPendingDelete(null);
        setPendingForce(business);
      } else {
        setError(message);
      }
    } finally {
      setRemoving(false);
    }
  }

  /** The second question: delete the reported figures along with it. */
  async function handleForceDelete() {
    if (!pendingForce) return;
    const business = pendingForce;

    setError(null);
    setRemoving(true);
    try {
      await deleteBusiness(companyId, business.id, true);
      onChanged(await listBusinesses(companyId));
      setPendingForce(null);
      toast.success(`${business.name} and its reported figures were deleted.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove business'));
    } finally {
      setRemoving(false);
    }
  }

  /**
   * Downloads the blank statement for this business, pre-filled with the accounts already mapped.
   * Handing out the format is what stops every business sending a differently shaped file.
   */
  async function handleTemplate(business: Business) {
    setError(null);
    try {
      const csv = await fetchTemplate(companyId, business.id);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${business.code}-statement-template.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not download the template'));
    }
  }

  return (
    <div className={styles.panel}>
      {businesses.length > 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Months reported · {gridYear}</h2>
            <span className={styles.cardSub}>a month counts once it is locked</span>
            <div className={cn(styles.heatKey, styles.cardRight)}>
              <span>
                <i className={styles.heatLocked} /> Locked
              </span>
              <span>
                <i className={styles.heatDraft} /> Draft
              </span>
              <span>
                <i className={styles.heatNone} /> Not reported
              </span>
            </div>
          </div>
          <div className={styles.heatScroll}>
            <div className={styles.heat} role="table" aria-label={`Months reported in ${gridYear}`}>
              <div className={styles.heatRow} role="row">
                <span role="columnheader" className={styles.heatName}>
                  Business
                </span>
                {MONTHS.map((name) => (
                  <span key={name} role="columnheader" className={styles.heatMonth}>
                    {name}
                  </span>
                ))}
              </div>
              {businesses.map((business, row) => (
                <div key={business.id} className={styles.heatRow} role="row">
                  <span role="rowheader" className={styles.heatName}>
                    {business.name}
                  </span>
                  {MONTHS.map((name, i) => {
                    const month = (snapshots[business.id] ?? []).filter(
                      (snap) => snap.periodYear === gridYear && snap.periodMonth === i + 1,
                    );
                    const state = month.some((snap) => snap.status === 'LOCKED')
                      ? 'locked'
                      : month.length > 0
                        ? 'draft'
                        : 'none';
                    return (
                      <span
                        key={name}
                        role="cell"
                        className={cn(
                          styles.heatCell,
                          state === 'locked' && styles.heatLocked,
                          state === 'draft' && styles.heatDraft,
                          state === 'none' && styles.heatNone,
                        )}
                        style={{ '--i': row * 12 + i } as CSSProperties}
                        title={`${business.name} · ${name} ${gridYear}: ${state === 'locked' ? 'locked' : state === 'draft' ? 'draft' : 'not reported'}`}
                      >
                        {state === 'locked' ? (
                          <Lock size={10} aria-label="Locked" />
                        ) : state === 'draft' ? (
                          'D'
                        ) : (
                          <span aria-label="Not reported">·</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <form className={cn(styles.card, styles.stackedForm)} onSubmit={handleAdd}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Add a business</h2>
          <span className={styles.cardSub}>external — it reports its own figures each month</span>
        </div>
        <div className={styles.fieldRow}>
          <Input
            placeholder="Code (BIZ01)"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
          />
          <Input
            placeholder="Business name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            placeholder="INR"
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            required
          />
        </div>

        {partners.length > 0 && (
          <div className={styles.shares}>
            <div className={styles.sharesHeader}>
              <span>Partner shares</span>
              <button type="button" className={styles.linkButton} onClick={addShare}>
                Add a partner
              </button>
              {shares.length > 0 && (
                <span className={sharesValid ? styles.hint : styles.warn}>
                  {total.toFixed(2)}% of 100%
                </span>
              )}
            </div>

            {shares.map((row, index) => (
              <div key={`${row.partnerId}-${index}`} className={styles.shareRow}>
                <Select
                  value={row.partnerId}
                  onChange={(event) =>
                    setShares(
                      shares.map((r, i) =>
                        i === index ? { ...r, partnerId: event.target.value } : r,
                      ),
                    )
                  }
                >
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="%"
                  value={row.percent}
                  onChange={(event) =>
                    setShares(
                      shares.map((r, i) =>
                        i === index ? { ...r, percent: event.target.value } : r,
                      ),
                    )
                  }
                />
                <IconButton
                  label="Remove share"
                  variant="danger"
                  onClick={() => setShares(shares.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}

            <p className={styles.hint}>
              Leave empty for a wholly owned business. Otherwise the shares must total exactly 100%.
            </p>
          </div>
        )}

        <div>
          <Button type="submit" variant="primary" disabled={busy || !sharesValid}>
            <Plus size={14} aria-hidden="true" />
            {busy ? 'Adding…' : 'Add business'}
          </Button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Add the businesses whose figures you want compared. They are external — nothing is posted here, their statements are uploaded each month."
        />
      ) : (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Businesses</h2>
            <span className={styles.count}>{businesses.length}</span>
            <span className={styles.cardSub}>
              open one to import, place ledgers and lock a month
            </span>
          </div>
          <Table surface="plain" stack zebra={false}>
            <thead>
              <tr>
                <th />
                <th>Code</th>
                <th>Name</th>
                <th>Reports in</th>
                <th>Partners</th>
                <th />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <Fragment key={business.id}>
                  <tr>
                    <td>
                      <IconButton
                        label={`Open ${business.name}`}
                        title="Import a month, place ledgers, lock"
                        aria-expanded={openId === business.id}
                        onClick={() => setOpenId(openId === business.id ? null : business.id)}
                      >
                        {openId === business.id ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </IconButton>
                    </td>
                    <td data-mono>{business.code}</td>
                    <td>{business.name}</td>
                    <td className={styles.mono}>{business.reportingCurrency}</td>
                    <td>
                      {business.partners.length === 0 ? (
                        <span className={styles.hint}>Wholly owned</span>
                      ) : (
                        <span className={styles.shareChips}>
                          {business.partners.map((share) => (
                            <span key={share.partnerId} className={styles.shareChip}>
                              {share.partnerName} <b>{Number(share.profitSharePercent)}%</b>
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>{!business.isActive && <Badge variant="neutral">Inactive</Badge>}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <IconButton
                          label={`Download statement template for ${business.name}`}
                          title="Download the statement template"
                          onClick={() => handleTemplate(business)}
                        >
                          <Download size={14} />
                        </IconButton>
                        <IconButton
                          label={`Remove ${business.name}`}
                          variant="danger"
                          onClick={() => setPendingDelete(business)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                  {openId === business.id && (
                    <tr>
                      <td colSpan={7}>
                        <BusinessWorkspace
                          companyId={companyId}
                          business={business}
                          partners={partners}
                          country={country}
                          portfolioCurrency={portfolioCurrency}
                          onSnapshotsChanged={() => void loadSnapshots().then(setSnapshots)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {/* The ordinary ask. */}
      {pendingDelete && (
        <ConfirmDialog
          open
          destructive
          busy={removing}
          title={`Remove ${pendingDelete.name}?`}
          confirmLabel="Remove business"
          cancelLabel="Keep"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        >
          A business that has already reported figures cannot simply be removed — you will be asked
          again if that is the case here.
        </ConfirmDialog>
      )}

      {/*
        The second ask, and the reason this dialog exists at all.

        window.confirm() was being handed three paragraphs — what deactivating does, what deleting
        does, and which one you probably want — inside a box that renders them as one run of text
        and labels the destructive choice "OK". The recommended answer is now the quiet button and
        the destructive one says exactly what it destroys.
      */}
      {pendingForce && (
        <ConfirmDialog
          open
          destructive
          busy={removing}
          title={`${pendingForce.name} has reported figures`}
          consequence="Deleting also destroys every snapshot and mapping it has. This cannot be undone."
          confirmLabel="Delete it and its figures"
          cancelLabel="Keep the figures"
          onConfirm={handleForceDelete}
          onCancel={() => setPendingForce(null)}
        >
          Deactivating keeps those figures and stops the business being chased for more, which is
          usually the right answer for one that has closed. Delete it only if it was created by
          mistake.
        </ConfirmDialog>
      )}
    </div>
  );
}
