import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

import { createVoucher } from '@/entities/voucher';
import type { Voucher, VoucherEntryInput, BillAllocationInput } from '@/entities/voucher';
import type { Currency } from '@/entities/currency';
import type { VoucherType } from '@/entities/voucher-type';
import type { Ledger } from '@/entities/ledger';
import { Button, Input, Select, Textarea, EmptyState } from '@/shared/ui';
import { getErrorMessage, cn, todayAsDateInput } from '@/shared/lib';

import { EntryExtras } from './EntryExtras';
import type { AllocationRow } from './EntryExtras';
import styles from './CreateVoucherForm.module.css';

export interface CreateVoucherFormProps {
  companyId: string;
  voucherTypes: VoucherType[];
  ledgers: Ledger[];
  /** Company feature flags — the per-entry detail below appears only for what is switched on. */
  billWiseEnabled: boolean;
  multiCurrencyEnabled: boolean;
  currencies: Currency[];
  baseCurrency: string;
  onCreated: (voucher: Voucher) => void;
  onCancel: () => void;
}

interface EntryRow {
  key: string;
  ledgerCode: string;
  debit: string;
  credit: string;
  currencyCode: string;
  exchangeRate: string;
  allocations: AllocationRow[];
}

let rowCounter = 0;
function newRow(defaultLedgerCode: string): EntryRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    ledgerCode: defaultLedgerCode,
    debit: '',
    credit: '',
    currencyCode: '',
    exchangeRate: '',
    allocations: [],
  };
}

let allocationCounter = 0;
function newAllocation(): AllocationRow {
  allocationCounter += 1;
  return {
    key: `alloc-${allocationCounter}`,
    allocationType: 'NEW_REF',
    reference: '',
    amount: '',
    dueDate: '',
  };
}

export function CreateVoucherForm({
  companyId,
  voucherTypes,
  ledgers,
  billWiseEnabled,
  multiCurrencyEnabled,
  currencies,
  baseCurrency,
  onCreated,
  onCancel,
}: CreateVoucherFormProps) {
  const activeVoucherTypes = voucherTypes.filter((type) => type.isActive);
  const defaultLedgerCode = ledgers[0]?.code ?? '';

  const [voucherTypeCode, setVoucherTypeCode] = useState(activeVoucherTypes[0]?.code ?? '');
  const [voucherDate, setVoucherDate] = useState(todayAsDateInput);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [narration, setNarration] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([
    newRow(defaultLedgerCode),
    newRow(defaultLedgerCode),
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ledgerByCode = new Map(ledgers.map((ledger) => [ledger.code, ledger]));

  /**
   * A voucher balances in the base currency, so a foreign line is converted before it is counted.
   * Without a rate the line cannot be weighed at all — the bar then says so rather than claiming
   * the voucher is out of balance, which would be a different and misleading complaint.
   */
  const rateFor = (row: EntryRow) => (row.currencyCode ? Number(row.exchangeRate) || 0 : 1);
  const awaitingRate = entries.some((row) => row.currencyCode && !Number(row.exchangeRate));

  const totalDebit = entries.reduce((sum, row) => sum + (Number(row.debit) || 0) * rateFor(row), 0);
  const totalCredit = entries.reduce(
    (sum, row) => sum + (Number(row.credit) || 0) * rateFor(row),
    0,
  );
  const isBalanced =
    !awaitingRate && totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  function updateRow(key: string, patch: Partial<EntryRow>) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setEntries((rows) => [...rows, newRow(defaultLedgerCode)]);
  }

  function removeRow(key: string) {
    setEntries((rows) => (rows.length > 2 ? rows.filter((row) => row.key !== key) : rows));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payloadEntries: VoucherEntryInput[] = entries.map((row) => {
      const allocations: BillAllocationInput[] = row.allocations
        .filter((allocation) => Number(allocation.amount) > 0)
        .map((allocation) => ({
          allocationType: allocation.allocationType,
          reference:
            allocation.allocationType === 'ON_ACCOUNT' ? undefined : allocation.reference,
          amount: Number(allocation.amount),
          dueDate: allocation.allocationType === 'NEW_REF' && allocation.dueDate
            ? allocation.dueDate
            : undefined,
        }));

      return {
        ledgerCode: row.ledgerCode,
        debit: Number(row.debit) || 0,
        credit: Number(row.credit) || 0,
        billAllocations: allocations.length > 0 ? allocations : undefined,
        currencyCode: row.currencyCode || undefined,
        exchangeRate: row.currencyCode && row.exchangeRate ? Number(row.exchangeRate) : undefined,
      };
    });

    try {
      const voucher = await createVoucher(companyId, {
        voucherTypeCode,
        voucherDate,
        referenceNumber: referenceNumber || undefined,
        narration: narration || undefined,
        entries: payloadEntries,
      });
      onCreated(voucher);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create voucher'));
    } finally {
      setSubmitting(false);
    }
  }

  // A company now starts with no masters at all, so both <select>s can legitimately be empty.
  // Say what is missing instead of rendering a form that can never be submitted.
  const missing = [
    activeVoucherTypes.length === 0 ? 'an active voucher type' : null,
    ledgers.length === 0 ? 'at least one ledger' : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return (
      <EmptyState
        title="Finish setting up this company"
        description={`A voucher needs ${missing.join(' and ')}. Add ${missing.length > 1 ? 'them' : 'it'} from the company's Chart of accounts, then create the voucher.`}
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
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="voucher-type">
            Voucher type
          </label>
          <Select
            id="voucher-type"
            value={voucherTypeCode}
            onChange={(event) => setVoucherTypeCode(event.target.value)}
            required
          >
            {activeVoucherTypes.map((type) => (
              <option key={type.id} value={type.code}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="voucher-date">
            Date
          </label>
          <Input
            id="voucher-date"
            type="date"
            value={voucherDate}
            onChange={(event) => setVoucherDate(event.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="voucher-reference">
            Reference (optional)
          </label>
          <Input
            id="voucher-reference"
            placeholder="REF-001"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="voucher-narration">
          Narration (optional)
        </label>
        <Textarea
          id="voucher-narration"
          placeholder="Office rent payment for May 2026"
          value={narration}
          onChange={(event) => setNarration(event.target.value)}
        />
      </div>

      <div className={styles.entriesHeader}>
        <span className={styles.label}>Entries</span>
        <Button type="button" variant="ghost" onClick={addRow}>
          <Plus size={14} /> Add row
        </Button>
      </div>

      <div className={styles.entriesTable}>
        <div className={cn(styles.entriesRow, styles.entriesRowHead)}>
          <span>Ledger</span>
          <span>Debit</span>
          <span>Credit</span>
          <span />
        </div>
        {entries.map((row) => (
          <div key={row.key} className={styles.entriesRow}>
            <Select
              value={row.ledgerCode}
              onChange={(event) => updateRow(row.key, { ledgerCode: event.target.value })}
              required
            >
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.code}>
                  {ledger.name} ({ledger.code})
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={row.debit}
              onChange={(event) => updateRow(row.key, { debit: event.target.value, credit: '' })}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={row.credit}
              onChange={(event) => updateRow(row.key, { credit: event.target.value, debit: '' })}
            />
            <button
              type="button"
              className={styles.removeRow}
              onClick={() => removeRow(row.key)}
              disabled={entries.length <= 2}
              aria-label="Remove entry"
            >
              <Trash2 size={15} />
            </button>

            <EntryExtras
              entryAmount={Number(row.debit) || Number(row.credit) || 0}
              billwise={billWiseEnabled && Boolean(ledgerByCode.get(row.ledgerCode)?.maintainBillwise)}
              allocations={row.allocations}
              onAllocationsChange={(allocations) => updateRow(row.key, { allocations })}
              onAddAllocation={() =>
                updateRow(row.key, { allocations: [...row.allocations, newAllocation()] })
              }
              multiCurrency={multiCurrencyEnabled}
              currencies={currencies}
              baseCurrency={baseCurrency}
              currencyCode={row.currencyCode}
              exchangeRate={row.exchangeRate}
              onCurrencyChange={(currencyCode) => updateRow(row.key, { currencyCode })}
              onExchangeRateChange={(exchangeRate) => updateRow(row.key, { exchangeRate })}
            />
          </div>
        ))}
      </div>

      <div className={cn(styles.balanceBar, isBalanced ? styles.balanceOk : styles.balanceOff)}>
        {isBalanced ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        <span>
          Debit {totalDebit.toFixed(2)} · Credit {totalCredit.toFixed(2)}
          {!isBalanced && ` · Difference ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !isBalanced || !voucherTypeCode}
        >
          {submitting ? 'Saving…' : 'Save voucher'}
        </Button>
      </div>
    </form>
  );
}
