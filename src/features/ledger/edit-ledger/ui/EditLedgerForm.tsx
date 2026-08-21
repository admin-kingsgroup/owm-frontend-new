import { useState } from 'react';
import type { FormEvent } from 'react';

import { updateLedger } from '@/entities/ledger';
import type { Ledger, LedgerType, BalanceSide } from '@/entities/ledger';
import type { AccountGroup } from '@/entities/account-group';
import type { Currency } from '@/entities/currency';
import { Button, Checkbox, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './EditLedgerForm.module.css';

export interface EditLedgerFormProps {
  companyId: string;
  ledger: Ledger;
  accountGroups: AccountGroup[];
  /** Empty when the company does not use multi-currency; the field is then not shown at all. */
  currencies: Currency[];
  baseCurrency: string;
  onSaved: (ledger: Ledger) => void;
  onCancel: () => void;
}

const LEDGER_TYPES: LedgerType[] = ['GENERAL', 'CASH', 'BANK'];
const BALANCE_SIDES: BalanceSide[] = ['DEBIT', 'CREDIT'];

export function EditLedgerForm({
  companyId,
  ledger,
  accountGroups,
  currencies,
  baseCurrency,
  onSaved,
  onCancel,
}: EditLedgerFormProps) {
  const currentGroup = accountGroups.find((group) => group.id === ledger.accountGroupId);

  const [name, setName] = useState(ledger.name);
  const [accountGroupCode, setAccountGroupCode] = useState(currentGroup?.code ?? '');
  const [ledgerType, setLedgerType] = useState<LedgerType>(ledger.ledgerType);
  const [openingBalance, setOpeningBalance] = useState(ledger.openingBalance);
  const [openingBalanceType, setOpeningBalanceType] = useState<BalanceSide>(
    ledger.openingBalanceType,
  );
  const [isActive, setIsActive] = useState(ledger.isActive);

  const [maintainBillwise, setMaintainBillwise] = useState(ledger.maintainBillwise);
  const [currencyCode, setCurrencyCode] = useState(
    currencies.find((currency) => currency.id === ledger.currencyId)?.code ?? '',
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateLedger(companyId, ledger.id, {
        name,
        accountGroupCode: accountGroupCode || undefined,
        ledgerType,
        openingBalance: Number(openingBalance) || 0,
        openingBalanceType,
        maintainBillwise,
        isActive,
        // `null` clears it back to base; a code sets it. A system ledger never sends the field at
        // all, because the server refuses it and the picker is hidden for one.
        ...(ledger.isSystem ? {} : { currencyCode: currencyCode || null }),
      });
      onSaved(updated);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update ledger'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-ledger-code">
          Code
        </label>
        <Input id="edit-ledger-code" value={ledger.code} disabled />
      </div>
      <p className={styles.hint}>Code can&apos;t be changed after creation.</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-ledger-name">
          Name
        </label>
        <Input
          id="edit-ledger-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-ledger-group">
          Account group
        </label>
        <Select
          id="edit-ledger-group"
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
          <label className={styles.label} htmlFor="edit-ledger-type">
            Ledger type
          </label>
          <Select
            id="edit-ledger-type"
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
          <label className={styles.label} htmlFor="edit-ledger-opening-balance">
            Opening balance
          </label>
          <Input
            id="edit-ledger-opening-balance"
            type="number"
            min={0}
            step="0.01"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-ledger-opening-balance-type">
            Balance side
          </label>
          <Select
            id="edit-ledger-opening-balance-type"
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


      {currencies.length > 0 && !ledger.isSystem && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-ledger-currency">
            Currency
          </label>
          <Select
            id="edit-ledger-currency"
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
        id="edit-ledger-billwise"
        label="Maintain balances bill by bill"
        hint="For customer and supplier ledgers. Their invoices are then tracked individually and appear in Receivables or Payables with ageing."
        checked={maintainBillwise}
        onChange={(event) => setMaintainBillwise(event.target.checked)}
      />

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        Active
      </label>

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
