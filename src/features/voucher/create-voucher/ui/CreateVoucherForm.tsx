import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

import { createVoucher } from '@/entities/voucher';
import type { Voucher, VoucherEntryInput, BillAllocationInput } from '@/entities/voucher';
import type { Currency } from '@/entities/currency';
import type { VoucherType } from '@/entities/voucher-type';
import type { Ledger } from '@/entities/ledger';
import { Button, Input, Select, Textarea, EmptyState } from '@/shared/ui';
import { getErrorMessage, cn, todayAsDateInput } from '@/shared/lib';

import { computeBalance } from '../lib/balance';
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
  /**
   * Ledger code to what that account stands at right now, already written the way the company
   * writes money — "12,84,320 Dr".
   *
   * Tally shows this beside every line for a reason: it is the difference between keying a payment
   * and knowing what the payment leaves behind. Optional and formatted by the caller, because the
   * page is what knows the company's currency and country; a code that is missing from the map
   * simply shows a dash, so a slow or failed balance read never holds up voucher entry.
   */
  ledgerBalances?: ReadonlyMap<string, string>;
  /**
   * The voucher type to open on, for the function keys that raise a particular one. Ignored if the
   * company has no active type with that code, which leaves the first active type as before.
   */
  initialVoucherTypeCode?: string;
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

/** Tag names whose own Ctrl+A must be left alone. */
const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT'];

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
  ledgerBalances,
  initialVoucherTypeCode,
  onCreated,
  onCancel,
}: CreateVoucherFormProps) {
  const activeVoucherTypes = voucherTypes.filter((type) => type.isActive);
  const defaultLedgerCode = ledgers[0]?.code ?? '';

  // The dialog unmounts when it closes, so this is re-read every time it is opened — which is what
  // lets F5 and F6 open the same form on different voucher types.
  const [voucherTypeCode, setVoucherTypeCode] = useState(() =>
    activeVoucherTypes.some((type) => type.code === initialVoucherTypeCode)
      ? (initialVoucherTypeCode as string)
      : (activeVoucherTypes[0]?.code ?? ''),
  );
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
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code]));

  /**
   * The currency an account is denominated in, or '' for the base currency.
   *
   * A line follows its account: choosing a party who keeps their books in USD puts the line in
   * USD without the accountant deciding it again. It stays overridable — the currency select is
   * still there — but the common case needs no thought, which matters when a month is keyed in
   * one sitting.
   */
  function currencyCodeForLedger(ledgerCode: string): string {
    const ledger = ledgerByCode.get(ledgerCode);
    return ledger?.currencyId ? (currencyCodeById.get(ledger.currencyId) ?? '') : '';
  }

  const { totalDebit, totalCredit, isBalanced, awaitingRate } = computeBalance(entries);

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
          reference: allocation.allocationType === 'ON_ACCOUNT' ? undefined : allocation.reference,
          amount: Number(allocation.amount),
          dueDate:
            allocation.allocationType === 'NEW_REF' && allocation.dueDate
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

  /**
   * Accept from wherever the cursor happens to be, rather than tabbing to the button.
   *
   * Ctrl+Enter types nothing, so it works in every field. Ctrl+A is Tally's own accept key and is
   * honoured too, but only outside a text field — inside one it must go on selecting that field's
   * text, which is what everyone else's Ctrl+A does.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    const withCtrl = event.ctrlKey || event.metaKey;
    if (!withCtrl || event.altKey || event.shiftKey) return;

    const typing = event.target instanceof HTMLElement && EDITABLE.includes(event.target.tagName);
    const accept = event.key === 'Enter' || (event.code === 'KeyA' && !typing);
    if (!accept) return;

    event.preventDefault();
    // requestSubmit rather than handleSubmit, so the browser's own validation still runs first.
    event.currentTarget.requestSubmit();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
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
          <span>Particulars</span>
          <span className={styles.balanceHead}>Current balance</span>
          <span>Debit</span>
          <span>Credit</span>
          <span />
        </div>
        {entries.map((row) => (
          <div key={row.key} className={styles.entriesRow}>
            <Select
              value={row.ledgerCode}
              onChange={(event) => {
                const ledgerCode = event.target.value;
                // The rate belongs to the old account's currency, so it is cleared with it —
                // carrying it over would silently price the new line at the wrong rate.
                updateRow(row.key, {
                  ledgerCode,
                  currencyCode: currencyCodeForLedger(ledgerCode),
                  exchangeRate: '',
                });
              }}
              required
            >
              {ledgers.map((ledger) => (
                <option key={ledger.id} value={ledger.code}>
                  {ledger.name} ({ledger.code})
                </option>
              ))}
            </Select>
            {/* Read-only context, not a field: what this account stands at before the line is
                posted. A dash while the balances are still being read, or if they could not be. */}
            <span className={styles.balanceCell}>{ledgerBalances?.get(row.ledgerCode) ?? '—'}</span>
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
              billwise={
                billWiseEnabled && Boolean(ledgerByCode.get(row.ledgerCode)?.maintainBillwise)
              }
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

      {/*
        The totals sit on the same grid as the rows above, so each one lands under the column it
        totals — which is how a voucher is checked: read down the debits, read down the credits,
        and look at the one figure that has to be zero.
      */}
      <div className={cn(styles.balanceBar, isBalanced ? styles.balanceOk : styles.balanceOff)}>
        <span className={styles.balanceLead}>
          {isBalanced ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {awaitingRate ? 'Rate needed' : 'Total'}
        </span>

        {awaitingRate ? (
          // Naming the real problem: a line with no rate cannot be weighed, so reporting a
          // difference here would send the user looking at their amounts instead of the rate.
          <span className={styles.balanceNote}>
            Enter an exchange rate for every foreign line to check the balance
          </span>
        ) : (
          <>
            <span className={styles.balanceDifference}>
              Difference {Math.abs(totalDebit - totalCredit).toFixed(2)}
            </span>
            <span className={styles.balanceTotal}>{totalDebit.toFixed(2)}</span>
            <span className={styles.balanceTotal}>{totalCredit.toFixed(2)}</span>
            <span />
          </>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <span className={styles.acceptHint}>
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd> accepts
        </span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !isBalanced || !voucherTypeCode}
        >
          {submitting ? 'Saving…' : 'Accept voucher'}
        </Button>
      </div>
    </form>
  );
}
