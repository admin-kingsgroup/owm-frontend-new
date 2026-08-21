import { useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';

import { createPartner, deletePartner, listPartners } from '@/entities/kg';
import type { Partner } from '@/entities/kg';
import { Button, Input, Badge, EmptyState } from '@/shared/ui';
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

  async function handleDelete(partner: Partner) {
    if (!window.confirm(`Remove ${partner.name}?`)) return;
    setError(null);
    try {
      await deletePartner(companyId, partner.id);
      onChanged(await listPartners(companyId));
    } catch (err) {
      // The server refuses anyone holding a share and says why — surfaced as written, because the
      // reason is the useful part.
      setError(getErrorMessage(err, 'Could not remove partner'));
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
        <table className={styles.table}>
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
                <td className={styles.mono}>{partner.code}</td>
                <td>{partner.name}</td>
                <td>{!partner.isActive && <Badge variant="neutral">Inactive</Badge>}</td>
                <td>
                  <button
                    type="button"
                    className={styles.iconAction}
                    onClick={() => handleDelete(partner)}
                    aria-label={`Remove ${partner.name}`}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
