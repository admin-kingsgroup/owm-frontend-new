import { useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2, Download } from 'lucide-react';

import { createBusiness, deleteBusiness, fetchTemplate, listBusinesses } from '@/entities/kg';
import type { Business, Partner } from '@/entities/kg';
import { Button, Input, Select, Badge, EmptyState } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface BusinessesPanelProps {
  companyId: string;
  businesses: Business[];
  partners: Partner[];
  onChanged: (businesses: Business[]) => void;
}

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
  onChanged,
}: BusinessesPanelProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDelete(business: Business) {
    if (!window.confirm(`Remove ${business.name}?`)) return;
    setError(null);
    try {
      await deleteBusiness(companyId, business.id);
      onChanged(await listBusinesses(companyId));
    } catch (err) {
      // Refused once it has snapshots, with the reason — which tells the user to deactivate instead.
      setError(getErrorMessage(err, 'Could not remove business'));
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
      <form className={styles.stackedForm} onSubmit={handleAdd}>
        <div className={styles.inlineForm}>
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
                <button
                  type="button"
                  className={styles.iconAction}
                  onClick={() => setShares(shares.filter((_, i) => i !== index))}
                  aria-label="Remove share"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <p className={styles.hint}>
              Leave empty for a wholly owned business. Otherwise the shares must total exactly 100%.
            </p>
          </div>
        )}

        <Button type="submit" variant="primary" disabled={busy || !sharesValid}>
          {busy ? 'Adding…' : 'Add business'}
        </Button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {businesses.length === 0 ? (
        <EmptyState
          title="No businesses yet"
          description="Add the businesses whose figures you want compared. They are external — nothing is posted here, their statements are uploaded each month."
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
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
              <tr key={business.id}>
                <td className={styles.mono}>{business.code}</td>
                <td>{business.name}</td>
                <td className={styles.mono}>{business.reportingCurrency}</td>
                <td>
                  {business.partners.length === 0 ? (
                    <span className={styles.hint}>Wholly owned</span>
                  ) : (
                    business.partners
                      .map((share) => `${share.partnerName} ${Number(share.profitSharePercent)}%`)
                      .join(' · ')
                  )}
                </td>
                <td>{!business.isActive && <Badge variant="neutral">Inactive</Badge>}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.iconAction}
                      onClick={() => handleTemplate(business)}
                      aria-label={`Download statement template for ${business.name}`}
                      title="Download the statement template"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconAction}
                      onClick={() => handleDelete(business)}
                      aria-label={`Remove ${business.name}`}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
