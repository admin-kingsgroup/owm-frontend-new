import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { createCompany, getSeedPreview } from '@/entities/company';
import type { Company, CompanyType, SeedPreview } from '@/entities/company';
import { Button, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';
import { COMPANY_DEFAULTS } from '@/shared/constants';

import styles from './CreateCompanyForm.module.css';

export interface CreateCompanyFormProps {
  onCreated: (company: Company) => void;
  onCancel: () => void;
}

const { financialYearStartMonth } = COMPANY_DEFAULTS;

/**
 * The choice is irreversible: seeding runs once, inside creation, so a company cannot be
 * re-typed afterwards without holding another kind's chart of accounts. The descriptions are
 * therefore written to be read before deciding, not as labels.
 */
const COMPANY_TYPE_OPTIONS: Array<{ value: CompanyType; label: string; description: string }> = [
  {
    value: 'TRADING',
    label: 'Trading business',
    description:
      'Buys and sells. Full chart of accounts with sales, purchases, stock and trade parties, and all eight voucher types.',
  },
  {
    value: 'PERSONAL',
    label: 'Personal wealth ledger',
    description:
      'Tracks what a household owns, owes and spends. No sales, purchases or stock — receipts, payments, contra and journal only.',
  },
  {
    value: 'ANALYTICS',
    label: 'Portfolio analytics',
    description:
      'Compares other businesses from uploaded figures. Nothing is posted here, so it gets the group tree to map uploads onto and no ledgers or voucher types.',
  },
];

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
  const [type, setType] = useState<CompanyType>('TRADING');
  const [preview, setPreview] = useState<SeedPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [financialYear] = useState(currentFinancialYear);
  const [financialYearStart, setFinancialYearStart] = useState(financialYear.start);
  const [financialYearEnd, setFinancialYearEnd] = useState(financialYear.end);
  const [baseCurrency, setBaseCurrency] = useState<string>(COMPANY_DEFAULTS.baseCurrency);
  const [country, setCountry] = useState<string>(COMPANY_DEFAULTS.country);
  const [state, setState] = useState('');
  const [timezone, setTimezone] = useState<string>(COMPANY_DEFAULTS.timezone);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-read on every change of type, so what is shown is always what this choice would create.
  useEffect(() => {
    let cancelled = false;

    getSeedPreview(type)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setPreviewError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(getErrorMessage(err, 'Could not load what this would create'));
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const company = await createCompany({
        name,
        code,
        type,
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

      <div className={styles.field}>
        <label className={styles.label} htmlFor="company-type">
          Company type
        </label>
        <Select
          id="company-type"
          value={type}
          onChange={(event) => setType(event.target.value as CompanyType)}
        >
          {COMPANY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className={styles.hint}>
          {COMPANY_TYPE_OPTIONS.find((option) => option.value === type)?.description}{' '}
          <strong>This cannot be changed later.</strong>
        </p>
      </div>

      {previewError && <p className={styles.error}>{previewError}</p>}

      {preview && (
        <details className={styles.preview}>
          <summary className={styles.previewSummary}>
            Creating this company adds {preview.accountGroups.length} account groups,{' '}
            {preview.ledgers.length} ledgers and {preview.voucherTypes.length} voucher types — see
            the full list
          </summary>

          <div className={styles.previewBody}>
            <h4 className={styles.previewHeading}>Account groups</h4>
            <ul className={styles.previewList}>
              {preview.accountGroups.map((group) => (
                <li key={group.code}>
                  {group.parentCode ? `${group.parentCode} › ` : ''}
                  {group.name}
                </li>
              ))}
            </ul>

            {preview.ledgers.length > 0 && (
              <>
                <h4 className={styles.previewHeading}>Ledgers</h4>
                <ul className={styles.previewList}>
                  {preview.ledgers.map((ledger) => (
                    <li key={ledger.code}>
                      {ledger.name} <span className={styles.previewMuted}>({ledger.groupCode})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {preview.voucherTypes.length > 0 && (
              <>
                <h4 className={styles.previewHeading}>Voucher types</h4>
                <ul className={styles.previewList}>
                  {preview.voucherTypes.map((voucherType) => (
                    <li key={voucherType.code}>
                      {voucherType.name}{' '}
                      <span className={styles.previewMuted}>({voucherType.prefix})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}

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
