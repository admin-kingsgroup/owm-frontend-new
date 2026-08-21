import { useState } from 'react';

import { updateCompany } from '@/entities/company';
import type { Company, CompanyFeatures } from '@/entities/company';
import { Badge, Button, Checkbox } from '@/shared/ui';
import { companyStatusVariant } from '@/entities/company';
import { getErrorMessage } from '@/shared/lib';

import styles from './CompanySettingsPanel.module.css';

export interface CompanySettingsPanelProps {
  company: Company;
  onChanged: (company: Company) => void;
}

/**
 * Tally's F11. Each switch changes what the software will accept, not just what it shows — so the
 * hints say what turning it on actually lets you do, rather than restating the name.
 */
type FeatureKey = keyof CompanyFeatures;

/**
 * `available` may depend on the company, not just on whether we built the feature — GST is Indian
 * law, so it is offered to Indian companies and to nobody else. The server enforces the same rule;
 * this is here so the switch explains itself rather than failing on save.
 */
const FEATURES: Array<{
  key: FeatureKey;
  label: string;
  hint: string;
  available: (company: Company) => boolean;
  unavailableHint?: (company: Company) => string;
}> = [
  {
    key: 'billWiseDetails',
    label: 'Maintain balances bill by bill',
    hint: 'Track what each customer and supplier owes per invoice, with ageing. Also required before exchange gain or loss can be worked out on settlement.',
    available: () => true,
  },
  {
    key: 'multiCurrency',
    label: 'Multi-currency',
    hint: 'Record vouchers in other currencies at a dated exchange rate. Reports still total in the base currency.',
    available: () => true,
  },
  {
    key: 'costCentres',
    label: 'Cost centres',
    hint: 'Not built yet.',
    available: () => false,
  },
  { key: 'inventory', label: 'Inventory', hint: 'Not built yet.', available: () => false },
  {
    key: 'gst',
    label: 'GST',
    hint: 'Indian goods and services tax on vouchers, and the returns that follow from it.',
    available: (company) => company.country.toUpperCase() === 'IN',
    unavailableHint: (company) =>
      `GST is an Indian statute. This company is registered in ${company.country.toUpperCase()}, so it transacts without it — its own country's compliance is a separate feature.`,
  },
];

export function CompanySettingsPanel({ company, onChanged }: CompanySettingsPanelProps) {
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: FeatureKey, value: boolean) {
    setSaving(key);
    setError(null);
    try {
      onChanged(await updateCompany(company.id, { features: { [key]: value } }));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update this setting'));
    } finally {
      setSaving(null);
    }
  }

  /**
   * Deactivating is reversible and destroys nothing, so it lives here beside the other settings
   * rather than behind a danger zone. It still asks first, because from this screen the company
   * being changed is the one you are standing in.
   */
  async function toggleStatus() {
    const deactivating = company.status === 'ACTIVE';

    if (deactivating) {
      const confirmed = window.confirm(
        `Deactivate ${company.name}? It will be hidden from day-to-day use and left out of the group totals, but nothing is deleted — you can reactivate it any time.`,
      );
      if (!confirmed) return;
    }

    setTogglingStatus(true);
    setError(null);
    try {
      onChanged(await updateCompany(company.id, { status: deactivating ? 'INACTIVE' : 'ACTIVE' }));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change the company status'));
    } finally {
      setTogglingStatus(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div>
        <h2 className={styles.title}>Features</h2>
        <p className={styles.hint}>
          Everything starts off. Switch on only what this company needs — a feature left off keeps
          its fields out of the way entirely.
        </p>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.list}>
        {FEATURES.map((feature) => {
          const available = feature.available(company);

          return (
            <Checkbox
              key={feature.key}
              id={`feature-${feature.key}`}
              label={feature.label}
              hint={available ? feature.hint : (feature.unavailableHint?.(company) ?? feature.hint)}
              checked={company.features[feature.key]}
              disabled={!available || saving !== null}
              onChange={(event) => toggle(feature.key, event.target.checked)}
            />
          );
        })}
      </div>

      <dl className={styles.meta}>
        <div>
          <dt>Base currency</dt>
          <dd>{company.baseCurrency}</dd>
        </div>
        <div>
          <dt>Default masters</dt>
          <dd>version {company.seedVersion}</dd>
        </div>
      </dl>
      <p className={styles.hint}>
        The base currency is fixed when the company is created — every report totals in it, and
        vouchers already posted are denominated in it.
      </p>

      {/*
        The only way to do this used to be an unlabelled power icon on a card two screens away,
        which is the same as there being no way to do it.
      */}
      <div className={styles.status}>
        <div className={styles.statusText}>
          <div className={styles.statusHeading}>
            Status
            <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
          </div>
          <p className={styles.hint}>
            {company.status === 'ACTIVE'
              ? 'This company is in day-to-day use and counts towards the group totals.'
              : 'This company is hidden from day-to-day use and left out of the group totals. Its books are untouched and still readable.'}
          </p>
        </div>
        <Button
          type="button"
          variant={company.status === 'ACTIVE' ? 'ghost' : 'primary'}
          onClick={toggleStatus}
          disabled={togglingStatus}
        >
          {company.status === 'ACTIVE' ? 'Deactivate company' : 'Reactivate company'}
        </Button>
      </div>
    </div>
  );
}
