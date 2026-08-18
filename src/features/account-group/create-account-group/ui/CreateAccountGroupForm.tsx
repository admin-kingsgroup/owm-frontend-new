import { useState } from 'react';
import type { FormEvent } from 'react';

import { createAccountGroup } from '@/entities/account-group';
import type { AccountGroup, AccountNature, GroupType } from '@/entities/account-group';
import { Button, Input, Select } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './CreateAccountGroupForm.module.css';

export interface CreateAccountGroupFormProps {
  companyId: string;
  existingGroups: AccountGroup[];
  onCreated: (group: AccountGroup) => void;
  onCancel: () => void;
}

const NATURES: AccountNature[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE'];
const GROUP_TYPES: GroupType[] = ['BALANCE_SHEET', 'PROFIT_LOSS'];

export function CreateAccountGroupForm({
  companyId,
  existingGroups,
  onCreated,
  onCancel,
}: CreateAccountGroupFormProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentCode, setParentCode] = useState('');
  const [nature, setNature] = useState<AccountNature>('ASSET');
  const [groupType, setGroupType] = useState<GroupType>('BALANCE_SHEET');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const group = await createAccountGroup(companyId, {
        code,
        name,
        parentCode: parentCode || undefined,
        nature,
        groupType,
      });
      onCreated(group);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create account group'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="group-code">
          Code
        </label>
        <Input
          id="group-code"
          placeholder="MARKETABLE_SECURITIES"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="group-name">
          Name
        </label>
        <Input
          id="group-name"
          placeholder="Marketable Securities"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="group-parent">
          Parent group (optional)
        </label>
        <Select
          id="group-parent"
          value={parentCode}
          onChange={(event) => setParentCode(event.target.value)}
        >
          <option value="">— Top level —</option>
          {existingGroups.map((group) => (
            <option key={group.id} value={group.code}>
              {group.name} ({group.code})
            </option>
          ))}
        </Select>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="group-nature">
            Nature
          </label>
          <Select
            id="group-nature"
            value={nature}
            onChange={(event) => setNature(event.target.value as AccountNature)}
          >
            {NATURES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="group-type">
            Group type
          </label>
          <Select
            id="group-type"
            value={groupType}
            onChange={(event) => setGroupType(event.target.value as GroupType)}
          >
            {GROUP_TYPES.map((value) => (
              <option key={value} value={value}>
                {value.replace('_', ' ')}
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
          {submitting ? 'Creating…' : 'Create group'}
        </Button>
      </div>
    </form>
  );
}
