import { useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';

import { createPartner, deletePartner, listPartners } from '@/entities/kg';
import type { Partner } from '@/entities/kg';
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
import { getErrorMessage } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface PartnersPanelProps {
  companyId: string;
  partners: Partner[];
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
export function PartnersPanel({ companyId, partners, onChanged }: PartnersPanelProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The partner waiting on a yes, and whether the removal is in flight. */
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null);
  const [removing, setRemoving] = useState(false);

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
      <form className={styles.inlineForm} onSubmit={handleAdd}>
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
          {busy ? 'Adding…' : 'Add partner'}
        </Button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          description="Add the people who hold a share in any of these businesses. A wholly owned business needs none."
        />
      ) : (
        <Table surface="plain" stack>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr key={partner.id}>
                <td data-mono>{partner.code}</td>
                <td>{partner.name}</td>
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
