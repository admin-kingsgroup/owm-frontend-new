// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import type { AccountGroup } from '@/entities/account-group';
import type { Ledger } from '@/entities/ledger';

import { EditLedgerForm } from './EditLedgerForm';

const updateLedger = vi.fn();

/* Only the request is stood in for — the bank-details fields and helpers stay real. */
vi.mock('@/entities/ledger', async (importActual) => ({
  ...(await importActual<typeof import('@/entities/ledger')>()),
  updateLedger: (...args: unknown[]) => updateLedger(...args),
}));

const groups = [
  { id: 'g1', code: 'BANK_ACCOUNTS', name: 'Bank Accounts' },
] as unknown as AccountGroup[];

const hdfc: Ledger = {
  id: 'l1',
  companyId: 'c1',
  accountGroupId: 'g1',
  code: 'HDFC_BANK',
  name: 'HDFC Bank',
  ledgerType: 'BANK',
  openingBalance: '0',
  openingBalanceType: 'DEBIT',
  maintainBillwise: false,
  bankAccountHolderName: 'Shah Traders',
  bankAccountNumber: '50100123456789',
  bankCode: 'HDFC0001234',
  bankName: 'HDFC Bank, Andheri East',
  isSystem: false,
  isActive: true,
};

function renderForm(ledger: Ledger = hdfc) {
  return render(
    <EditLedgerForm
      companyId="c1"
      ledger={ledger}
      accountGroups={groups}
      currencies={[]}
      baseCurrency="INR"
      onSaved={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateLedger).toHaveBeenCalled());
  return updateLedger.mock.calls[0][2];
};

describe('editing a bank ledger', () => {
  beforeEach(() => {
    updateLedger.mockReset();
    updateLedger.mockResolvedValue(hdfc);
  });
  afterEach(cleanup);

  it('opens with the saved bank details filled in', () => {
    renderForm();
    expect((screen.getByLabelText(/A\/c no\./) as HTMLInputElement).value).toBe('50100123456789');
    expect((screen.getByLabelText(/Bank name & branch/) as HTMLInputElement).value).toBe(
      'HDFC Bank, Andheri East',
    );
  });

  it('sends a changed field, and clears one that was emptied', async () => {
    renderForm();
    type(/Bank code/, 'HDFC0009999');
    type(/Bank name & branch/, '  ');

    expect(await save()).toMatchObject({
      bankAccountNumber: '50100123456789',
      bankCode: 'HDFC0009999',
      bankName: null,
    });
  });

  it('clears all four when the ledger stops being a bank ledger', async () => {
    renderForm();
    type(/Ledger type/, 'GENERAL');

    expect(screen.queryByLabelText(/A\/c no\./)).toBeNull();
    expect(await save()).toMatchObject({
      ledgerType: 'GENERAL',
      bankAccountHolderName: null,
      bankAccountNumber: null,
      bankCode: null,
      bankName: null,
    });
  });
});
