import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { createPartner, deletePartner, listPartners } from '@/entities/kg';
import type { Business, Partner } from '@/entities/kg';
import {
  Button,
  Input,
  Badge,
  EmptyState,
  Table,
  IconButton,
  ConfirmDialog,
  toast,
} from '@/shared/ui';
import { cn, getErrorMessage } from '@/shared/lib';

import styles from './KgPage.module.css';

/** Two letters for the avatar: the first of each of the first two words, else the code's. */
function initials(partner: Pick<Partner, 'code' | 'name'>) {
  const words = partner.name.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
  return (
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : partner.code.slice(0, 2)
  ).toUpperCase();
}

export interface PartnersPanelProps {
  companyId: string;
  partners: Partner[];
  /** To say which businesses each partner holds a share of — read from the registry, not stored. */
  businesses: Business[];
  onChanged: (partners: Partner[]) => void;
}

/**
 * The people who hold shares in the businesses.
 *
 * Held once and reused, because the cross-business view is the point — the same person re-typed per
 * business under a slightly different spelling cannot be added up.
 *
 * They never sign in. Their figures reach them as a statement sent on from the Portfolio tab.
 */
export function PartnersPanel({ companyId, partners, businesses, onChanged }: PartnersPanelProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The partner waiting on a yes, and whether the removal is in flight. */
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null);
  const [removing, setRemoving] = useState(false);

  /** Each partner's shares, across every business that names them. */
  const holdings = (partnerId: string) =>
    businesses.flatMap((business) =>
      business.partners
        .filter((share) => share.partnerId === partnerId)
        .map((share) => ({ business: business.name, percent: Number(share.profitSharePercent) })),
    );

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPartner(companyId, { code, name });
      onChanged(await listPartners(companyId));
      setCode('');
      setName('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add partner'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const partner = pendingDelete;

    setError(null);
    setRemoving(true);
    try {
      await deletePartner(companyId, partner.id);
      onChanged(await listPartners(companyId));
      setPendingDelete(null);
      toast.success(`${partner.name} removed.`);
    } catch (err) {
      // The server refuses anyone holding a share and says why — surfaced as written, because the
      // reason is the useful part. The dialog stays open, still naming the partner it is about.
      setError(getErrorMessage(err, 'Could not remove partner'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={styles.panel}>
      <form className={cn(styles.card, styles.stackedForm)} onSubmit={handleAdd}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Add a partner</h2>
          <span className={styles.cardSub}>held once and reused across every business</span>
        </div>
        <div className={cn(styles.fieldRow, styles.fieldRowAction)}>
          <Input
            placeholder="Code (AFSHIN)"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
          />
          <Input
            placeholder="Name (Afshin Dhanani)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={busy}>
            <Plus size={14} aria-hidden="true" />
            {busy ? 'Adding…' : 'Add partner'}
          </Button>
        </div>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Add the people who hold a share in any of these businesses. A wholly owned business needs none."
        />
      ) : (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Partners</h2>
            <span className={styles.count}>{partners.length}</span>
            <span className={styles.cardSub}>
              they never sign in — their figures reach them as a statement
            </span>
          </div>
          <Table surface="plain" stack zebra={false}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Holds a share of</th>
                <th />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id}>
                  <td>
                    <span className={styles.person}>
                      <span className={styles.avatar} aria-hidden="true">
                        {initials(partner)}
                      </span>
                      {partner.name}
                    </span>
                  </td>
                  <td data-mono>{partner.code}</td>
                  <td>
                    {holdings(partner.id).length === 0 ? (
                      <span className={styles.hint}>No business yet</span>
                    ) : (
                      <span className={styles.shareChips}>
                        {holdings(partner.id).map((holding) => (
                          <span key={holding.business} className={styles.shareChip}>
                            {holding.business} <b>{holding.percent}%</b>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>{!partner.isActive && <Badge variant="neutral">Inactive</Badge>}</td>
                  <td>
                    <IconButton
                      label={`Remove ${partner.name}`}
                      variant="danger"
                      onClick={() => setPendingDelete(partner)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {/* Replaces window.confirm(). A partner holding a share cannot be removed at all, and the
          server says why — that refusal lands in the panel's own error line above. */}
      {pendingDelete && (
        <ConfirmDialog
          open
          destructive
          busy={removing}
          title={`Remove ${pendingDelete.name}?`}
          confirmLabel="Remove partner"
          cancelLabel="Keep"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        >
          A partner still holding a share of any business cannot be removed.
        </ConfirmDialog>
      )}
    </div>
  );
}
