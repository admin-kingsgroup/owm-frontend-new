import { useState } from 'react';
import type { FormEvent } from 'react';

import { createLedger } from '@/entities/ledger';
import type { Ledger, LedgerType, BalanceSide } from '@/entities/ledger';
import type { AccountGroup } from '@/entities/account-group';
import { Button, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CreateLedgerForm.module.css';

export interface CreateLedgerFormProps {
  companyId: string;
  accountGroups: AccountGroup[];
  onCreated: (ledger: Ledger) => void;
  onCancel: () => void;
}

const LEDGER_TYPES: LedgerType[] = ['GENERAL', 'CASH', 'BANK'];
const BALANCE_SIDES: BalanceSide[] = ['DEBIT', 'CREDIT'];

export function CreateLedgerForm({
  companyId,
  accountGroups,
  onCreated,
  onCancel,
}: CreateLedgerFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountGroupCode, setAccountGroupCode] = useState(accountGroups[0]?.code ?? '');
  const [ledgerType, setLedgerType] = useState<LedgerType>('GENERAL');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<BalanceSide>('DEBIT');

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
      });
      onCreated(ledger);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create ledger'));
    } finally {
      setSubmitting(false);
    }
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
