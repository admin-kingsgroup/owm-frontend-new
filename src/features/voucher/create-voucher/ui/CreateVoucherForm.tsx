import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

import { createVoucher } from '@/entities/voucher';
import type { Voucher, VoucherEntryInput } from '@/entities/voucher';
import type { VoucherType } from '@/entities/voucher-type';
import type { Ledger } from '@/entities/ledger';
import { Button, Input, Select, Textarea } from '@/shared/ui';
import { getErrorMessage, cn } from '@/shared/lib';

import styles from './CreateVoucherForm.module.css';

export interface CreateVoucherFormProps {
  companyId: string;
  voucherTypes: VoucherType[];
  ledgers: Ledger[];
  onCreated: (voucher: Voucher) => void;
  onCancel: () => void;
}

interface EntryRow {
  key: string;
  ledgerCode: string;
  debit: string;
  credit: string;
}

let rowCounter = 0;
function newRow(defaultLedgerCode: string): EntryRow {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, ledgerCode: defaultLedgerCode, debit: '', credit: '' };
}

const today = new Date().toISOString().slice(0, 10);

export function CreateVoucherForm({
  companyId,
  voucherTypes,
  ledgers,
  onCreated,
  onCancel,
}: CreateVoucherFormProps) {
  const activeVoucherTypes = voucherTypes.filter((type) => type.isActive);
  const defaultLedgerCode = ledgers[0]?.code ?? '';

  const [voucherTypeCode, setVoucherTypeCode] = useState(activeVoucherTypes[0]?.code ?? '');
  const [voucherDate, setVoucherDate] = useState(today);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [narration, setNarration] = useState('');
  const [entries, setEntries] = useState<EntryRow[]>([
    newRow(defaultLedgerCode),
    newRow(defaultLedgerCode),
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDebit = entries.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
  const totalCredit = entries.reduce((sum, row) => sum + (Number(row.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

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

    const payloadEntries: VoucherEntryInput[] = entries.map((row) => ({
      ledgerCode: row.ledgerCode,
      debit: Number(row.debit) || 0,
      credit: Number(row.credit) || 0,
    }));

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
