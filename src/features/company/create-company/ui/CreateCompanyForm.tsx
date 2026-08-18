import { useState } from 'react';
import type { FormEvent } from 'react';

import { createCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import { Button, Input } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CreateCompanyForm.module.css';

export interface CreateCompanyFormProps {
  onCreated: (company: Company) => void;
  onCancel: () => void;
}

const today = new Date();
const defaultFyStart = `${today.getFullYear()}-04-01`;
const defaultFyEnd = `${today.getFullYear() + 1}-03-31`;

export function CreateCompanyForm({ onCreated, onCancel }: CreateCompanyFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [legalName, setLegalName] = useState('');
  const [financialYearStart, setFinancialYearStart] = useState(defaultFyStart);
  const [financialYearEnd, setFinancialYearEnd] = useState(defaultFyEnd);
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [country, setCountry] = useState('IN');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const company = await createCompany({
        name,
        code,
        legalName: legalName || undefined,
        financialYearStart,
        financialYearEnd,
        baseCurrency,
        country,
        timezone,
      });
      onCreated(company);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create company'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="company-name">
          Company name
        </label>
        <Input
          id="company-name"
          placeholder="ABC Enterprises"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-code">
            Code
          </label>
          <Input
            id="company-code"
            placeholder="ABC001"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-legal-name">
            Legal name (optional)
          </label>
          <Input
            id="company-legal-name"
            placeholder="ABC Enterprises Pvt. Ltd."
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-fy-start">
            Financial year start
          </label>
          <Input
            id="company-fy-start"
            type="date"
            value={financialYearStart}
            onChange={(event) => setFinancialYearStart(event.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-fy-end">
            Financial year end
          </label>
          <Input
            id="company-fy-end"
            type="date"
            value={financialYearEnd}
            onChange={(event) => setFinancialYearEnd(event.target.value)}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-currency">
            Base currency
          </label>
          <Input
            id="company-currency"
            placeholder="INR"
            maxLength={3}
            value={baseCurrency}
            onChange={(event) => setBaseCurrency(event.target.value.toUpperCase())}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-country">
            Country
          </label>
          <Input
            id="company-country"
            placeholder="IN"
            maxLength={2}
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="company-timezone">
            Timezone
          </label>
          <Input
            id="company-timezone"
            placeholder="Asia/Kolkata"
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
          {submitting ? 'Creating…' : 'Create company'}
        </Button>
      </div>
    </form>
  );
}
