import { useState } from 'react';
import type { FormEvent } from 'react';

import { createLedger } from '@/entities/ledger';
import type { Ledger, LedgerType, BalanceSide } from '@/entities/ledger';
import type { AccountGroup } from '@/entities/account-group';
import type { Currency } from '@/entities/currency';
import { Button, Checkbox, Input, Select, EmptyState } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CreateLedgerForm.module.css';

export interface CreateLedgerFormProps {
  companyId: string;
  accountGroups: AccountGroup[];
  /** Empty when the company does not use multi-currency; the field is then not shown at all. */
  currencies: Currency[];
  baseCurrency: string;
  onCreated: (ledger: Ledger) => void;
  onCancel: () => void;
}

const LEDGER_TYPES: LedgerType[] = ['GENERAL', 'CASH', 'BANK'];
const BALANCE_SIDES: BalanceSide[] = ['DEBIT', 'CREDIT'];

export function CreateLedgerForm({
  companyId,
  accountGroups,
  currencies,
  baseCurrency,
  onCreated,
  onCancel,
}: CreateLedgerFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountGroupCode, setAccountGroupCode] = useState(accountGroups[0]?.code ?? '');
  const [ledgerType, setLedgerType] = useState<LedgerType>('GENERAL');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<BalanceSide>('DEBIT');

  const [maintainBillwise, setMaintainBillwise] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const ledger = await createLedger(companyId, {
        code,
        name,
        accountGroupCode,
        ledgerType,
        openingBalance: Number(openingBalance) || 0,
        openingBalanceType,
        maintainBillwise,
        // Omitted rather than sent empty: an empty string is not a currency code, and the account
        // simply stays on the company's base currency.
        ...(currencyCode ? { currencyCode } : {}),
      });
      onCreated(ledger);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create ledger'));
    } finally {
      setSubmitting(false);
    }
  }

  // A ledger must hang off an account group, and a new company starts with none. Without this
  // the group <select> would render with no options at all — an unexplained dead end.
  if (accountGroups.length === 0) {
    return (
      <EmptyState
        title="Create an account group first"
        description="Every ledger belongs to an account group, and this company does not have any yet. Add one from the Account groups panel, then come back."
        action={
          <Button type="button" variant="primary" onClick={onCancel}>
            Got it
          </Button>
        }
      />
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="ledger-code">
          Code
        </label>
        <Input
          id="ledger-code"
          placeholder="HDFC_BANK"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="ledger-name">
          Name
        </label>
        <Input
          id="ledger-name"
          placeholder="HDFC Bank"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="ledger-group">
          Account group
        </label>
        <Select
          id="ledger-group"
          value={accountGroupCode}
          onChange={(event) => setAccountGroupCode(event.target.value)}
          required
        >
          {accountGroups.map((group) => (
            <option key={group.id} value={group.code}>
              {group.name} ({group.code})
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ledger-type">
            Ledger type
          </label>
          <Select
            id="ledger-type"
            value={ledgerType}
            onChange={(event) => setLedgerType(event.target.value as LedgerType)}
          >
            {LEDGER_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ledger-opening-balance">
            Opening balance
          </label>
          <Input
            id="ledger-opening-balance"
            type="number"
            min={0}
            step="0.01"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ledger-opening-balance-type">
            Balance side
          </label>
          <Select
            id="ledger-opening-balance-type"
            value={openingBalanceType}
            onChange={(event) => setOpeningBalanceType(event.target.value as BalanceSide)}
          >
            {BALANCE_SIDES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </div>


      {currencies.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ledger-currency">
            Currency
          </label>
          <Select
            id="ledger-currency"
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
          >
            <option value="">{baseCurrency} (base)</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.code}>
                {currency.code} — {currency.name}
              </option>
            ))}
          </Select>
          <p className={styles.hint}>
            Set this only when the other party keeps their own books in another currency. Every
            voucher line against this account is then entered in that currency, with a rate.
          </p>
        </div>
      )}

      <Checkbox
        id="create-ledger-billwise"
        label="Maintain balances bill by bill"
        hint="For customer and supplier ledgers. Their invoices are then tracked individually and appear in Receivables or Payables with ageing."
        checked={maintainBillwise}
        onChange={(event) => setMaintainBillwise(event.target.checked)}
      />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create ledger'}
        </Button>
      </div>
    </form>
  );
}
