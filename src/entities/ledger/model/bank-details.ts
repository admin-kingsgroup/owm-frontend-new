import type { BankDetails, Ledger } from './types';

export const BANK_DETAIL_KEYS = [
  'bankAccountHolderName',
  'bankAccountNumber',
  'bankCode',
  'bankName',
] as const satisfies readonly (keyof BankDetails)[];

export const EMPTY_BANK_DETAILS: BankDetails = {
  bankAccountHolderName: '',
  bankAccountNumber: '',
  bankCode: '',
  bankName: '',
};

/** What a saved ledger holds, ready for the form to edit. */
export function bankDetailsOf(ledger: Ledger): BankDetails {
  return {
    bankAccountHolderName: ledger.bankAccountHolderName ?? '',
    bankAccountNumber: ledger.bankAccountNumber ?? '',
    bankCode: ledger.bankCode ?? '',
    bankName: ledger.bankName ?? '',
  };
}

/** For a new ledger: only the fields that were filled in, so a blank one is simply not sent. */
export function filledBankDetails(details: BankDetails): Partial<BankDetails> {
  const filled: Partial<BankDetails> = {};
  for (const key of BANK_DETAIL_KEYS) {
    const value = details[key].trim();
    if (value) filled[key] = value;
  }
  return filled;
}

/**
 * For an edit: every field, with a blank one sent as `null` so the server clears it.
 *
 * `keep` is false when the ledger is no longer a bank ledger. The fields are hidden then, and
 * details nobody can see or change should not stay stored behind the form, so they are cleared too.
 */
export function bankDetailsPatch(
  details: BankDetails,
  keep: boolean,
): Record<keyof BankDetails, string | null> {
  const patch = {} as Record<keyof BankDetails, string | null>;
  for (const key of BANK_DETAIL_KEYS) {
    patch[key] = keep ? details[key].trim() || null : null;
  }
  return patch;
}
