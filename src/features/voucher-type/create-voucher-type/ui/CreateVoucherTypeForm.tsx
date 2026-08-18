import { useState } from 'react';
import type { FormEvent } from 'react';

import { createVoucherType } from '@/entities/voucher-type';
import type { VoucherType, VoucherCategory } from '@/entities/voucher-type';
import { Button, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CreateVoucherTypeForm.module.css';

export interface CreateVoucherTypeFormProps {
  companyId: string;
  onCreated: (voucherType: VoucherType) => void;
  onCancel: () => void;
}

const CATEGORIES: VoucherCategory[] = [
  'SALES',
  'PURCHASE',
  'PAYMENT',
  'RECEIPT',
  'CONTRA',
  'JOURNAL',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
];

export function CreateVoucherTypeForm({
  companyId,
  onCreated,
  onCancel,
}: CreateVoucherTypeFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<VoucherCategory>('JOURNAL');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const voucherType = await createVoucherType(companyId, { code, name, category });
      onCreated(voucherType);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create voucher type'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="voucher-type-code">
          Code
        </label>
        <Input
          id="voucher-type-code"
          placeholder="BANK_TRANSFER"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="voucher-type-name">
          Name
        </label>
        <Input
          id="voucher-type-name"
          placeholder="Bank Transfer"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="voucher-type-category">
          Category
        </label>
        <Select
          id="voucher-type-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as VoucherCategory)}
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value.replace('_', ' ')}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create voucher type'}
        </Button>
      </div>
    </form>
  );
}
