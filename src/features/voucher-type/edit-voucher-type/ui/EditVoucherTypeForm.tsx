import { useState } from 'react';
import type { FormEvent } from 'react';

import { updateVoucherType } from '@/entities/voucher-type';
import type { VoucherType, NumberingMethod } from '@/entities/voucher-type';
import { Button, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './EditVoucherTypeForm.module.css';

export interface EditVoucherTypeFormProps {
  companyId: string;
  voucherType: VoucherType;
  onSaved: (voucherType: VoucherType) => void;
  onCancel: () => void;
}

export function EditVoucherTypeForm({
  companyId,
  voucherType,
  onSaved,
  onCancel,
}: EditVoucherTypeFormProps) {
  const [name, setName] = useState(voucherType.name);
  const [numberingMethod, setNumberingMethod] = useState<NumberingMethod>(
    voucherType.numberingMethod,
  );
  const [isActive, setIsActive] = useState(voucherType.isActive);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateVoucherType(companyId, voucherType.id, {
        name,
        numberingMethod: voucherType.isSystem ? undefined : numberingMethod,
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
          disabled={voucherType.isSystem}
          onChange={(event) => setNumberingMethod(event.target.value as NumberingMethod)}
        >
          <option value="AUTO">AUTO</option>
          <option value="MANUAL">MANUAL</option>
        </Select>
        {voucherType.isSystem && (
          <p className={styles.hint}>Numbering method is fixed for system voucher types.</p>
        )}
      </div>

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
