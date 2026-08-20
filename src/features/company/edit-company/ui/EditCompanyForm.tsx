import { useState } from 'react';
import type { FormEvent } from 'react';

import { updateCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import { Button, Input } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './EditCompanyForm.module.css';

export interface EditCompanyFormProps {
  company: Company;
  onSaved: (company: Company) => void;
  onCancel: () => void;
}

export function EditCompanyForm({ company, onSaved, onCancel }: EditCompanyFormProps) {
  const [name, setName] = useState(company.name);
  const [legalName, setLegalName] = useState(company.legalName ?? '');
  const [country, setCountry] = useState(company.country);
  const [timezone, setTimezone] = useState(company.timezone);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateCompany(company.id, {
        name,
        legalName: legalName || undefined,
        country,
        timezone,
      });
      onSaved(updated);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update company'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-company-code">
            Code
          </label>
          <Input id="edit-company-code" value={company.code} disabled />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-company-currency">
            Base currency
          </label>
          <Input id="edit-company-currency" value={company.baseCurrency} disabled />
        </div>
      </div>
      <p className={styles.hint}>Code and base currency can&apos;t be changed after creation.</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-company-name">
          Company name
        </label>
        <Input
          id="edit-company-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-company-legal-name">
          Legal name (optional)
        </label>
        <Input
          id="edit-company-legal-name"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
      </div>

      <p className={styles.note}>
        Financial years are managed separately, so a year can be closed or a new one opened
        without touching the company. This company&rsquo;s first year runs{' '}
        {company.financialYearStart.slice(0, 10)} to {company.financialYearEnd.slice(0, 10)}.
      </p>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-company-country">
            Country
          </label>
          <Input
            id="edit-company-country"
            maxLength={2}
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-company-timezone">
            Timezone
          </label>
          <Input
            id="edit-company-timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
