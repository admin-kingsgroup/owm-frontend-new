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

/**
 * `available` may depend on the company, not just on whether we built the feature — GST is Indian
 * law, so it is offered to Indian companies and to nobody else. The server enforces the same rule;
 * this is here so the switch explains itself rather than failing on save.
 */
/*
  Cost centres and inventory used to sit here as disabled rows reading "Not built yet". They are
  gone from the company entirely now — a field in the API that nothing reads is the same lie one
  layer down from a switch that does nothing. They come back the day something behind them does.
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
        Company status is deliberately not shown or changed here. Retiring a set of books is not a
        thing to do from a settings panel, and once it is not offered, neither is the way back —
        a lone "Reactivate" button describes a state this screen can no longer produce. Status
        remains an API concern; the company switcher is where a deactivated company is identified.
      */}
    </div>
  );
}
