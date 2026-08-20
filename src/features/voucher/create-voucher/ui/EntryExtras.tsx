import { Plus, Trash2 } from 'lucide-react';

import type { AllocationType } from '@/entities/voucher';
import type { Currency } from '@/entities/currency';
import { Input, Select } from '@/shared/ui';

import styles from './CreateVoucherForm.module.css';

export interface AllocationRow {
  key: string;
  allocationType: AllocationType;
  reference: string;
  amount: string;
  dueDate: string;
}

export interface EntryExtrasProps {
  /** The entry's own amount, which the allocations must add up to. */
  entryAmount: number;
  billwise: boolean;
  allocations: AllocationRow[];
  onAllocationsChange: (rows: AllocationRow[]) => void;
  multiCurrency: boolean;
  currencies: Currency[];
  baseCurrency: string;
  currencyCode: string;
  exchangeRate: string;
  onCurrencyChange: (code: string) => void;
  onExchangeRateChange: (rate: string) => void;
  onAddAllocation: () => void;
}

const ALLOCATION_TYPES: Array<{ value: AllocationType; label: string }> = [
  { value: 'NEW_REF', label: 'New bill' },
  { value: 'AGAINST_REF', label: 'Settle bill' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'ON_ACCOUNT', label: 'On account' },
];

/**
 * The per-entry detail Tally shows in a sub-screen: which currency this line is in, and which
 * bills it raises or settles.
 *
 * Both are hidden unless they apply — the company feature is on and, for bill-wise, the ledger is
 * one that is tracked invoice by invoice. A voucher for a company using neither looks exactly as
 * it did before.
 */
export function EntryExtras({
  entryAmount,
  billwise,
  allocations,
  onAllocationsChange,
  multiCurrency,
  currencies,
  baseCurrency,
  currencyCode,
  exchangeRate,
  onCurrencyChange,
  onExchangeRateChange,
  onAddAllocation,
}: EntryExtrasProps) {
  if (!billwise && !multiCurrency) return null;

  const allocated = allocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const unallocated = Number((entryAmount - allocated).toFixed(2));

  const update = (key: string, patch: Partial<AllocationRow>) =>
    onAllocationsChange(allocations.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className={styles.extras}>
      {multiCurrency && currencies.length > 0 && (
        <div className={styles.extrasRow}>
          <label className={styles.extrasLabel}>Currency</label>
          <Select value={currencyCode} onChange={(event) => onCurrencyChange(event.target.value)}>
            <option value="">{baseCurrency} (base)</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.code}>
                {currency.code}
              </option>
            ))}
          </Select>
          {currencyCode && (
            <Input
              type="number"
              step="0.0001"
              min="0"
              placeholder={`Rate — ${baseCurrency} per ${currencyCode}`}
              value={exchangeRate}
              onChange={(event) => onExchangeRateChange(event.target.value)}
            />
          )}
          {currencyCode && (
            <span className={styles.extrasHint}>
              Amounts above are in {currencyCode}. Leave the rate blank to use the rate on the
              voucher date.
            </span>
          )}
        </div>
      )}

      {billwise && (
        <div className={styles.allocations}>
          <div className={styles.extrasRow}>
            <span className={styles.extrasLabel}>Bill-wise</span>
            <button type="button" className={styles.addAllocation} onClick={onAddAllocation}>
              <Plus size={13} /> Add bill
            </button>
            <span
              className={unallocated === 0 ? styles.extrasHint : styles.extrasWarn}
              aria-live="polite"
            >
              {unallocated === 0
                ? 'Fully allocated'
                : `${unallocated > 0 ? 'Unallocated' : 'Over-allocated by'} ${Math.abs(unallocated).toFixed(2)}`}
            </span>
          </div>

          {allocations.map((row) => (
            <div key={row.key} className={styles.allocationRow}>
              <Select
                value={row.allocationType}
                onChange={(event) =>
                  update(row.key, { allocationType: event.target.value as AllocationType })
                }
              >
                {ALLOCATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Invoice reference"
                value={row.reference}
                disabled={row.allocationType === 'ON_ACCOUNT'}
                onChange={(event) => update(row.key, { reference: event.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={row.amount}
                onChange={(event) => update(row.key, { amount: event.target.value })}
              />
              <Input
                type="date"
                title="Due date"
                value={row.dueDate}
                disabled={row.allocationType !== 'NEW_REF'}
                onChange={(event) => update(row.key, { dueDate: event.target.value })}
              />
              <button
                type="button"
                className={styles.removeRow}
                aria-label="Remove bill allocation"
                onClick={() => onAllocationsChange(allocations.filter((r) => r.key !== row.key))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
