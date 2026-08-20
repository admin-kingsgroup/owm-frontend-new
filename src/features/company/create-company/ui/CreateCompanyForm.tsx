import { useState } from 'react';
import type { FormEvent } from 'react';

import { createCompany } from '@/entities/company';
import type { Company } from '@/entities/company';
import { Button, Input } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';
import { COMPANY_DEFAULTS } from '@/shared/constants';

import styles from './CreateCompanyForm.module.css';

export interface CreateCompanyFormProps {
  onCreated: (company: Company) => void;
  onCancel: () => void;
}

const { financialYearStartMonth } = COMPANY_DEFAULTS;

const asDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The financial year that is *currently open*, resolved per mount rather than at module load —
 * a tab left open overnight would otherwise keep offering a stale year. Before the opening month
 * the live year is still the one that began last calendar year (in January the running Indian FY
 * is Apr previous-year to Mar this-year), which a plain `getFullYear()` gets wrong for a quarter
 * of the calendar. Built in UTC so the rendered day cannot slip a timezone.
 */
function currentFinancialYear(): { start: string; end: string } {
  const now = new Date();
  const startYear =
    now.getMonth() + 1 < financialYearStartMonth ? now.getFullYear() - 1 : now.getFullYear();

  // Day 0 of the opening month rolls back to the last day of the preceding month, which is the
  // financial year's closing day whichever month it opens on.
  return {
    start: asDay(new Date(Date.UTC(startYear, financialYearStartMonth - 1, 1))),
    end: asDay(new Date(Date.UTC(startYear + 1, financialYearStartMonth - 1, 0))),
  };
}

export function CreateCompanyForm({ onCreated, onCancel }: CreateCompanyFormProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [legalName, setLegalName] = useState('');
  const [financialYear] = useState(currentFinancialYear);
  const [financialYearStart, setFinancialYearStart] = useState(financialYear.start);
  const [financialYearEnd, setFinancialYearEnd] = useState(financialYear.end);
  const [baseCurrency, setBaseCurrency] = useState<string>(COMPANY_DEFAULTS.baseCurrency);
  const [country, setCountry] = useState<string>(COMPANY_DEFAULTS.country);
  const [state, setState] = useState('');
  const [timezone, setTimezone] = useState<string>(COMPANY_DEFAULTS.timezone);

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
        state: state || undefined,
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
          <label className={styles.label} htmlFor="company-state">
            State
          </label>
          <Input
            id="company-state"
            placeholder="Maharashtra"
            value={state}
            onChange={(event) => setState(event.target.value)}
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
