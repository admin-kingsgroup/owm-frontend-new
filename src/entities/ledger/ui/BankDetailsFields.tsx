import { Field, Input } from '@/shared/ui';

import type { BankDetails } from '../model/types';

import styles from './BankDetailsFields.module.css';

export interface BankDetailsFieldsProps {
  /** Keeps the ids unique when two forms are on the page at once ("create-ledger", "edit-ledger"). */
  idPrefix: string;
  value: BankDetails;
  onChange: (value: BankDetails) => void;
}

/**
 * The bank account behind a BANK ledger: shown by the create and edit forms when the ledger type
 * is BANK. Every field is optional — a bank ledger posts without them.
 */
export function BankDetailsFields({ idPrefix, value, onChange }: BankDetailsFieldsProps) {
  const set = (key: keyof BankDetails) => (event: { target: { value: string } }) =>
    onChange({ ...value, [key]: event.target.value });

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Bank account details</legend>

      <Field label="A/c holder name" htmlFor={`${idPrefix}-bank-holder`} optional>
        <Input
          id={`${idPrefix}-bank-holder`}
          placeholder="As printed on the cheque book"
          value={value.bankAccountHolderName}
          onChange={set('bankAccountHolderName')}
          maxLength={120}
          autoComplete="off"
        />
      </Field>

      <div className={styles.row}>
        <Field label="A/c no." htmlFor={`${idPrefix}-bank-account-number`} optional>
          <Input
            id={`${idPrefix}-bank-account-number`}
            placeholder="50100123456789"
            value={value.bankAccountNumber}
            onChange={set('bankAccountNumber')}
            inputMode="text"
            maxLength={40}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Bank code (IFSC / SWIFT)"
          htmlFor={`${idPrefix}-bank-code`}
          hint="IFSC for an Indian account, SWIFT for a foreign one."
          optional
        >
          <Input
            id={`${idPrefix}-bank-code`}
            placeholder="HDFC0001234"
            value={value.bankCode}
            onChange={set('bankCode')}
            maxLength={20}
            autoComplete="off"
            className={styles.upper}
          />
        </Field>
      </div>

      <Field label="Bank name & branch" htmlFor={`${idPrefix}-bank-name`} optional>
        <Input
          id={`${idPrefix}-bank-name`}
          placeholder="HDFC Bank, Andheri East"
          value={value.bankName}
          onChange={set('bankName')}
          maxLength={200}
          autoComplete="off"
        />
      </Field>
    </fieldset>
  );
}
