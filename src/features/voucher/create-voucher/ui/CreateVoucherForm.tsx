import { Fragment, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleCheck,
  Lock,
  Plus,
  Save,
  Scale,
  Send,
  Trash2,
} from 'lucide-react';

import { createVoucher, postVoucher, updateVoucher } from '@/entities/voucher';
import type {
  Voucher,
  VoucherEntry,
  VoucherEntryInput,
  BillAllocationInput,
} from '@/entities/voucher';
import type { Currency } from '@/entities/currency';
import { functionKeyFor, inFunctionKeyOrder } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import type { Ledger } from '@/entities/ledger';
import { Button, Input, Select, Textarea, EmptyState, toast } from '@/shared/ui';
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
  /**
   * An existing voucher to edit instead of keying a new one. The form opens filled in from it, its
   * type is fixed (the number belongs to the type's series), and saving edits it in place — a
   * posted voucher stays posted under the same number, the way Tally edits one.
   */
  voucher?: Voucher;
  /**
   * The voucher as it stands once the form is done with it — posted when Post voucher was pressed
   * and the post went through, a draft otherwise. In edit mode, the edited voucher.
   */
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
  /*
    Carried through an edit untouched. The form has no fields for them, but a bank-imported line
    holds its UTR here, and dropping it on save would break matching it against the statement.
  */
  narration: string;
  instrumentNumber: string;
  instrumentDate: string;
  /** Set when the bank has already shown this line; its account and amount are then locked. */
  reconciledOn: string;
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
    narration: '',
    instrumentNumber: '',
    instrumentDate: '',
    reconciledOn: '',
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

/**
 * A saved line as the form edits it.
 *
 * A foreign line is reopened in its own currency, at the rate it was posted at — the base figures
 * are what that rate produced, and re-keying them would convert them a second time. The stored rate
 * is sent back explicitly, so an edit never quietly re-prices a line at today's rate.
 */
function rowFromEntry(entry: VoucherEntry): EntryRow {
  const row = newRow(entry.ledgerCode);
  const foreign = entry.currencyCode && entry.fcAmount !== undefined;
  const signed = foreign ? Number(entry.fcAmount) : Number(entry.debit) - Number(entry.credit);

  return {
    ...row,
    debit: signed > 0 ? String(signed) : '',
    credit: signed < 0 ? String(Math.abs(signed)) : '',
    currencyCode: foreign ? (entry.currencyCode as string) : '',
    exchangeRate: foreign ? (entry.exchangeRate ?? '') : '',
    allocations: (entry.billAllocations ?? []).map((allocation) => ({
      ...newAllocation(),
      allocationType: allocation.allocationType,
      reference: allocation.reference ?? '',
      amount: String(allocation.amount),
      dueDate: allocation.dueDate ? allocation.dueDate.slice(0, 10) : '',
    })),
    narration: entry.narration ?? '',
    instrumentNumber: entry.instrumentNumber ?? '',
    instrumentDate: entry.instrumentDate ? entry.instrumentDate.slice(0, 10) : '',
    reconciledOn: entry.reconciledOn ?? '',
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
  voucher: editing,
  onCreated,
  onCancel,
}: CreateVoucherFormProps) {
  /*
    In the order the keys run — F4, F5, F6 … — so the tabs read the way the hand moves. An edit
    shows only the voucher's own type, active or not: its number belongs to that type's series, so
    the type cannot change, and a type switched off since does not make its vouchers uneditable.
  */
  const activeVoucherTypes = editing
    ? voucherTypes.filter((type) => type.id === editing.voucherTypeId)
    : inFunctionKeyOrder(voucherTypes.filter((type) => type.isActive));
  const defaultLedgerCode = ledgers[0]?.code ?? '';
  const editingPosted = editing?.status === 'POSTED';

  // The dialog unmounts when it closes, so this is re-read every time it is opened — which is what
  // lets F5 and F6 open the same form on different voucher types.
  const [voucherTypeCode, setVoucherTypeCode] = useState(() =>
    activeVoucherTypes.some((type) => type.code === initialVoucherTypeCode)
      ? (initialVoucherTypeCode as string)
      : (activeVoucherTypes[0]?.code ?? ''),
  );
  const [voucherDate, setVoucherDate] = useState(() =>
    editing ? editing.voucherDate.slice(0, 10) : todayAsDateInput(),
  );
  const [referenceNumber, setReferenceNumber] = useState(editing?.referenceNumber ?? '');
  const [narration, setNarration] = useState(editing?.narration ?? '');
  const [entries, setEntries] = useState<EntryRow[]>(() =>
    editing && editing.entries.length >= 2
      ? editing.entries.map(rowFromEntry)
      : [newRow(defaultLedgerCode), newRow(defaultLedgerCode)],
  );
  /** A reconciled line pins the date too: the bank showed it on a day that must not move. */
  const anyReconciled = entries.some((row) => row.reconciledOn);

  const [submitting, setSubmitting] = useState<'draft' | 'post' | null>(null);
  /** The Post button, which Ctrl+Enter presses — so the browser's own validation runs first. */
  const postButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);

  const ledgerByCode = new Map(ledgers.map((ledger) => [ledger.code, ledger]));

  /*
    The picker shows a ledger by its name alone — the code is the system's handle, not what a person
    looks for. Only the code is unique, though, so when two ledgers share a name the code is added to
    those two, and only those, to keep them apart.
  */
  const nameCounts = new Map<string, number>();
  for (const ledger of ledgers) {
    const key = ledger.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const ledgerLabel = (ledger: Ledger) =>
    (nameCounts.get(ledger.name.trim().toLowerCase()) ?? 0) > 1
      ? `${ledger.name} (${ledger.code})`
      : ledger.name;

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
    setEntries((rows) =>
      rows.length > 2 ? rows.filter((row) => row.key !== key || row.reconciledOn) : rows,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    /*
      Which button sent it. Post voucher creates and then posts; Save as draft only creates, which
      is what this form did on its own before — a draft is in no statement until someone posts it.
    */
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode: 'draft' | 'post' = submitter?.value === 'draft' ? 'draft' : 'post';
    setSubmitting(mode);
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
        narration: row.narration || undefined,
        instrumentNumber: row.instrumentNumber || undefined,
        instrumentDate: row.instrumentDate || undefined,
      };
    });

    let voucher: Voucher;
    try {
      voucher = editing
        ? /*
            Every header field is sent as it stands, empty included — `undefined` means "leave it"
            to the server, so a reference cleared in the form would otherwise survive the save.
          */
          await updateVoucher(companyId, editing.id, {
            voucherDate,
            referenceNumber,
            narration,
            entries: payloadEntries,
          })
        : await createVoucher(companyId, {
            voucherTypeCode,
            voucherDate,
            referenceNumber: referenceNumber || undefined,
            narration: narration || undefined,
            entries: payloadEntries,
          });
    } catch (err) {
      setError(
        getErrorMessage(err, editing ? 'Could not save the changes' : 'Could not create voucher'),
      );
      setSubmitting(null);
      return;
    }

    // A posted voucher is already in the books — its edit is the whole of the save.
    if (mode === 'post' && voucher.status === 'DRAFT') {
      try {
        voucher = await postVoucher(companyId, voucher.id);
      } catch (err) {
        /*
          The voucher exists either way — it was created before the post was refused. Saying so is
          the whole point: keying it again would file it twice. It stays a draft, in the register,
          for whoever fixes what the server objected to.
        */
        toast.error(
          `${voucher.voucherNumber} was saved as a draft but not posted: ${getErrorMessage(err, 'the post was refused')}`,
        );
      }
    }

    setSubmitting(null);
    onCreated(voucher);
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
    // requestSubmit rather than handleSubmit, so the browser's own validation still runs first —
    // and through the Post button, because accepting from the keyboard is accepting into the books.
    if (postButton.current && !postButton.current.disabled) {
      event.currentTarget.requestSubmit(postButton.current);
    }
  }

  const difference = Math.abs(totalDebit - totalCredit);
  const nothingEntered = totalDebit === 0 && totalCredit === 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      {/*
        The company's own voucher types as tabs, each with the key that raises it from anywhere — so
        the form teaches the keys while it is being used. A radio group: one is always chosen.
      */}
      <div className={styles.types} role="radiogroup" aria-label="Voucher type">
        {activeVoucherTypes.map((type) => {
          const key = functionKeyFor(type.code);
          const chosen = type.code === voucherTypeCode;
          return (
            <button
              key={type.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              className={cn(styles.type, chosen && styles.typeChosen)}
              onClick={() => setVoucherTypeCode(type.code)}
            >
              {type.name}
              {key && <kbd className={styles.typeKey}>{key}</kbd>}
            </button>
          );
        })}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="voucher-date">
            Date
          </label>
          <Input
            id="voucher-date"
            type="date"
            value={voucherDate}
            onChange={(event) => setVoucherDate(event.target.value)}
            disabled={anyReconciled}
            title={
              anyReconciled
                ? 'A line is reconciled with the bank statement — un-reconcile it to change the date'
                : undefined
            }
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

      <div className={cn(styles.field, styles.narration)}>
        <label className={styles.label} htmlFor="voucher-narration">
          Narration (optional)
        </label>
        <Textarea
          id="voucher-narration"
          placeholder="Office rent payment for May 2026"
          rows={1}
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

      {/*
        A real table, not a grid of divs. Every cell here is an amount belonging to a named account
        under a named column, and a screen reader can only say "Debit, HDFC Bank, 68,240" if the
        markup says which column and which row it is in. The per-entry detail sits in a row of its
        own spanning the width, so the columns above it stay aligned.
      */}
      <div className={styles.entriesFrame}>
        <table className={styles.entriesTable}>
          <thead>
            <tr className={styles.entriesRowHead}>
              <th scope="col">Particulars</th>
              <th scope="col" className={styles.balanceHead}>
                Current balance
              </th>
              <th scope="col" className={styles.amountHead}>
                Debit
              </th>
              <th scope="col" className={styles.amountHead}>
                Credit
              </th>
              <th scope="col">
                <span className={styles.srOnly}>Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => {
              /*
                The bank has already shown this line, so its account and amount must stay as they
                are — the server refuses the save otherwise. Locked here so that is plain before
                anything is typed, rather than discovered on Save.
              */
              const locked = Boolean(row.reconciledOn);
              const lockedHint = locked
                ? 'Reconciled with the bank statement — un-reconcile it to change this line'
                : undefined;
              return (
                <Fragment key={row.key}>
                  <tr className={styles.entriesRow}>
                    <td>
                      <Select
                        disabled={locked}
                        title={lockedHint}
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
                        {/*
                        A saved line can name an account no longer in the list. Without its own
                        option the select would show — and save — the first ledger instead.
                      */}
                        {row.ledgerCode && !ledgerByCode.has(row.ledgerCode) && (
                          <option value={row.ledgerCode}>{row.ledgerCode} (not available)</option>
                        )}
                        {ledgers.map((ledger) => (
                          <option key={ledger.id} value={ledger.code}>
                            {ledgerLabel(ledger)}
                          </option>
                        ))}
                      </Select>
                      {locked && (
                        <span className={styles.lockedNote}>
                          <Lock size={12} /> Reconciled
                        </span>
                      )}
                    </td>
                    {/* Read-only context, not a field: what this account stands at before the line is
                    posted. A dash while the balances are still being read, or if not readable. */}
                    <td className={styles.balanceCell}>
                      {ledgerBalances?.get(row.ledgerCode) ?? '—'}
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        aria-label={`Debit for ${ledgerByCode.get(row.ledgerCode)?.name ?? 'this line'}`}
                        value={row.debit}
                        disabled={locked}
                        title={lockedHint}
                        onChange={(event) =>
                          updateRow(row.key, { debit: event.target.value, credit: '' })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        aria-label={`Credit for ${ledgerByCode.get(row.ledgerCode)?.name ?? 'this line'}`}
                        value={row.credit}
                        disabled={locked}
                        title={lockedHint}
                        onChange={(event) =>
                          updateRow(row.key, { credit: event.target.value, debit: '' })
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeRow}
                        onClick={() => removeRow(row.key)}
                        disabled={entries.length <= 2 || locked}
                        aria-label="Remove entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>

                  {/*
                The per-entry detail — bill allocation and the line's currency — in a row of its own
                spanning the table, so the four columns above it stay in line. EntryExtras renders
                nothing at all when neither feature is on, and an empty row would still take space,
                so the row itself is conditional on the same two flags.
              */}
                  {(billWiseEnabled || multiCurrencyEnabled) && (
                    <tr className={styles.extrasRowHolder}>
                      <td colSpan={5}>
                        <EntryExtras
                          entryAmount={Number(row.debit) || Number(row.credit) || 0}
                          billwise={
                            billWiseEnabled &&
                            Boolean(ledgerByCode.get(row.ledgerCode)?.maintainBillwise)
                          }
                          allocations={row.allocations}
                          onAllocationsChange={(allocations) => updateRow(row.key, { allocations })}
                          onAddAllocation={() =>
                            updateRow(row.key, {
                              allocations: [...row.allocations, newAllocation()],
                            })
                          }
                          multiCurrency={multiCurrencyEnabled}
                          currencies={currencies}
                          baseCurrency={baseCurrency}
                          currencyCode={row.currencyCode}
                          exchangeRate={row.exchangeRate}
                          onCurrencyChange={(currencyCode) => updateRow(row.key, { currencyCode })}
                          onExchangeRateChange={(exchangeRate) =>
                            updateRow(row.key, { exchangeRate })
                          }
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>

          {/*
        The totals sit on the same grid as the rows above, so each one lands under the column it
        totals — which is how a voucher is checked: read down the debits, read down the credits,
        and look at the one figure that has to be zero.
      */}
          {/*
          The totals belong to the table, not beside it: each one lands under the column it totals,
          which is how a voucher is checked — read down the debits, read down the credits, and look
          at the one figure that has to be zero.
        */}
          <tfoot
            className={cn(styles.balanceBar, isBalanced ? styles.balanceOk : styles.balanceOff)}
          >
            <tr>
              {/*
              The difference sits beside the word Total rather than in a column of its own: it is
              the one figure that has to reach zero, and it stays on screen at every width — the
              balance column is the one that goes when there is no room for it.
            */}
              <th scope="row" className={styles.balanceLead}>
                {isBalanced ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {awaitingRate ? 'Rate needed' : 'Total'}
                {!awaitingRate && (
                  <span className={styles.balanceDifference}>
                    Difference {Math.abs(totalDebit - totalCredit).toFixed(2)}
                  </span>
                )}
              </th>

              {awaitingRate ? (
                // Naming the real problem: a line with no rate cannot be weighed, so reporting a
                // difference here would send the user looking at their amounts instead of the rate.
                <td colSpan={4} className={styles.balanceNote}>
                  Enter an exchange rate for every foreign line to check the balance
                </td>
              ) : (
                <>
                  <td className={styles.balanceCell} />
                  <td className={styles.balanceTotal}>{totalDebit.toFixed(2)}</td>
                  <td className={styles.balanceTotal}>{totalCredit.toFixed(2)}</td>
                  <td />
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/*
        Whether it can go into the books, said in words as well as colour, and the one figure that
        has to reach zero. Announced politely as it changes, so a screen reader hears "Balanced"
        the moment the last amount is typed.
      */}
      <div
        className={cn(
          styles.state,
          isBalanced ? styles.stateOk : nothingEntered ? styles.stateIdle : styles.stateOff,
        )}
        role="status"
        aria-live="polite"
      >
        {isBalanced ? <CircleCheck size={22} /> : <Scale size={22} />}
        <span>
          <b>
            {awaitingRate
              ? 'Exchange rate needed'
              : isBalanced
                ? 'Balanced — ready to post'
                : nothingEntered
                  ? 'Enter the amounts'
                  : `Out by ${difference.toFixed(2)}`}
          </b>
          <small>
            {isBalanced
              ? 'Debits equal credits'
              : 'A voucher posts only when its debits equal its credits'}
          </small>
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/*
        Said before Save is pressed, not after: a posted voucher's edit lands in every report at
        once, and the audit trail keeps what it said before — the edit log the law asks for.
      */}
      {editingPosted && (
        <p className={styles.editNote}>
          This voucher is posted. Saving changes the books straight away, under the same number{' '}
          {editing?.voucherNumber}. The old version is kept in the audit trail.
        </p>
      )}

      <div className={styles.actions}>
        <span className={styles.acceptHint}>
          <kbd>Ctrl</kbd> + <kbd>Enter</kbd> {editingPosted ? 'saves' : 'posts'}
        </span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {/* A posted voucher cannot go back to being a draft, so it has no draft button to offer. */}
        {!editingPosted && (
          <Button
            type="submit"
            value="draft"
            variant="ghost"
            className={styles.draftButton}
            disabled={submitting !== null || !isBalanced || !voucherTypeCode}
          >
            <Save size={15} />{' '}
            {submitting === 'draft' ? 'Saving…' : editing ? 'Save draft' : 'Save as draft'}
          </Button>
        )}
        <Button
          ref={postButton}
          type="submit"
          value="post"
          variant="primary"
          disabled={submitting !== null || !isBalanced || !voucherTypeCode}
        >
          {editingPosted ? <Save size={15} /> : <Send size={15} />}{' '}
          {editingPosted
            ? submitting === 'post'
              ? 'Saving…'
              : 'Save changes'
            : submitting === 'post'
              ? 'Posting…'
              : editing
                ? 'Save & post'
                : 'Post voucher'}
        </Button>
      </div>
    </form>
  );
}
