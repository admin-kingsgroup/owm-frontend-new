import { useState } from 'react';
import type { FormEvent } from 'react';

import { updateVoucherType, previewVoucherNumber } from '@/entities/voucher-type';
import type {
  VoucherType,
  NumberingMethod,
  NumberingConfig,
  ResetFrequency,
  VoucherNumberFormat,
} from '@/entities/voucher-type';
import { Button, Checkbox, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './EditVoucherTypeForm.module.css';

export interface EditVoucherTypeFormProps {
  companyId: string;
  voucherType: VoucherType;
  companyCode: string;
  financialYearLabel: string;
  /** False once this type has issued a number — its format can no longer change. */
  numberingEditable: boolean;
  /**
   * Why this series could not appear on a GST invoice, if it could not. Shown to every company,
   * not only Indian ones, so the format can be corrected before GST is switched on rather than
   * after a year of invoices carrying a number that cannot be filed.
   */
  gstReason?: string;
  onSaved: (voucherType: VoucherType) => void;
  onCancel: () => void;
}

const RESET_FREQUENCIES: Array<{ value: ResetFrequency; label: string }> = [
  { value: 'NEVER', label: 'Never — one sequence forever' },
  { value: 'YEARLY', label: 'Every financial year' },
  { value: 'HALF_YEARLY', label: 'Every half year' },
  { value: 'QUARTERLY', label: 'Every quarter' },
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'DAILY', label: 'Every day' },
];

export function EditVoucherTypeForm({
  companyId,
  voucherType,
  companyCode,
  financialYearLabel,
  numberingEditable,
  gstReason,
  onSaved,
  onCancel,
}: EditVoucherTypeFormProps) {
  const [name, setName] = useState(voucherType.name);
  const [numberingMethod, setNumberingMethod] = useState<NumberingMethod>(
    voucherType.numberingMethod,
  );
  const [numbering, setNumbering] = useState<NumberingConfig>(voucherType.numbering);
  const [isActive, setIsActive] = useState(voucherType.isActive);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchNumbering = (patch: Partial<NumberingConfig>) =>
    setNumbering((current) => ({ ...current, ...patch }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateVoucherType(companyId, voucherType.id, {
        name,
        numberingMethod,
        // Sending the format once numbers exist would be rejected, so it is left out entirely.
        numbering: numberingEditable ? numbering : undefined,
        isActive,
      });
      onSaved(updated);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update voucher type'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-voucher-type-code">
            Code
          </label>
          <Input id="edit-voucher-type-code" value={voucherType.code} disabled />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="edit-voucher-type-category">
            Category
          </label>
          <Input
            id="edit-voucher-type-category"
            value={voucherType.category.replace('_', ' ')}
            disabled
          />
        </div>
      </div>
      <p className={styles.hint}>Code and category can&apos;t be changed after creation.</p>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-voucher-type-name">
          Name
        </label>
        <Input
          id="edit-voucher-type-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="edit-voucher-type-numbering">
          Numbering method
        </label>
        <Select
          id="edit-voucher-type-numbering"
          value={numberingMethod}
          onChange={(event) => setNumberingMethod(event.target.value as NumberingMethod)}
        >
          <option value="AUTO">Automatic</option>
          <option value="AUTO_MANUAL_OVERRIDE">Automatic, can be typed over</option>
          <option value="MANUAL">Manual</option>
        </Select>
      </div>

      <fieldset className={styles.fieldset} disabled={!numberingEditable}>
        <legend className={styles.legend}>Number format</legend>

        {!numberingEditable && (
          <p className={styles.lockNote}>
            This voucher type has already issued numbers, so its format is fixed. Changing the width
            or prefix now would break a sequence already printed on documents — create another
            voucher type if you need a different format.
          </p>
        )}

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-prefix">
              Prefix
            </label>
            <Input
              id="vt-prefix"
              value={numbering.prefix}
              placeholder={voucherType.code}
              maxLength={10}
              onChange={(event) => patchNumbering({ prefix: event.target.value.toUpperCase() })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-suffix">
              Suffix
            </label>
            <Input
              id="vt-suffix"
              value={numbering.suffix}
              maxLength={10}
              onChange={(event) => patchNumbering({ suffix: event.target.value.toUpperCase() })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-length">
              Digits
            </label>
            <Input
              id="vt-length"
              type="number"
              min={1}
              max={12}
              value={numbering.numberLength}
              onChange={(event) =>
                patchNumbering({ numberLength: Number(event.target.value) || 1 })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-start">
              Start at
            </label>
            <Input
              id="vt-start"
              type="number"
              min={1}
              value={numbering.startingNumber}
              onChange={(event) =>
                patchNumbering({ startingNumber: Number(event.target.value) || 1 })
              }
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-reset">
              Restart numbering
            </label>
            <Select
              id="vt-reset"
              value={numbering.resetFrequency}
              onChange={(event) =>
                patchNumbering({ resetFrequency: event.target.value as ResetFrequency })
              }
            >
              {RESET_FREQUENCIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="vt-format">
              Include company code
            </label>
            <Select
              id="vt-format"
              value={numbering.numberFormat}
              onChange={(event) =>
                patchNumbering({ numberFormat: event.target.value as VoucherNumberFormat })
              }
            >
              <option value="COMPANY_PREFIXED">Yes</option>
              <option value="TALLY_STYLE">No — Tally style</option>
            </Select>
          </div>
        </div>

        <Checkbox
          id="vt-prefill"
          label="Pad the serial with leading zeros"
          checked={numbering.prefillWithZero}
          onChange={(event) => patchNumbering({ prefillWithZero: event.target.checked })}
        />

        <p className={styles.preview}>
          Next number looks like{' '}
          <strong>
            {previewVoucherNumber(numbering, companyCode, voucherType.code, financialYearLabel)}
          </strong>
        </p>
        {gstReason && <p className={styles.lockNote}>{gstReason}</p>}
        {numbering.resetFrequency !== 'NEVER' && (
          <p className={styles.hint}>
            The period is stamped in automatically. Without it the serial would repeat every time
            the counter restarts, and two vouchers would end up with the same number.
          </p>
        )}
      </fieldset>

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
