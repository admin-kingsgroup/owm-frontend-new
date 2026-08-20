import { useState } from 'react';

import { updateCompany } from '@/entities/company';
import type { Company, CompanyFeatures } from '@/entities/company';
import { Checkbox } from '@/shared/ui';
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

const FEATURES: Array<{
  key: FeatureKey;
  label: string;
  hint: string;
  available: boolean;
}> = [
  {
    key: 'billWiseDetails',
    label: 'Maintain balances bill by bill',
    hint: 'Track what each customer and supplier owes per invoice, with ageing. Also required before exchange gain or loss can be worked out on settlement.',
    available: true,
  },
  {
    key: 'multiCurrency',
    label: 'Multi-currency',
    hint: 'Record vouchers in other currencies at a dated exchange rate. Reports still total in the base currency.',
    available: true,
  },
  {
    key: 'costCentres',
    label: 'Cost centres',
    hint: 'Not built yet.',
    available: false,
  },
  { key: 'inventory', label: 'Inventory', hint: 'Not built yet.', available: false },
  { key: 'gst', label: 'GST', hint: 'Not built yet.', available: false },
];

export function CompanySettingsPanel({ company, onChanged }: CompanySettingsPanelProps) {
  const [saving, setSaving] = useState<FeatureKey | null>(null);
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
        {FEATURES.map((feature) => (
          <Checkbox
            key={feature.key}
            id={`feature-${feature.key}`}
            label={feature.label}
            hint={feature.hint}
            checked={company.features[feature.key]}
            disabled={!feature.available || saving !== null}
            onChange={(event) => toggle(feature.key, event.target.checked)}
          />
        ))}
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
    </div>
  );
}
