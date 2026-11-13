// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import type { AccountGroup } from '@/entities/account-group';
import type { Ledger } from '@/entities/ledger';

import { CreateLedgerForm } from './CreateLedgerForm';

const createLedger = vi.fn();

/* Only the request is stood in for — the bank-details fields and helpers stay real. */
vi.mock('@/entities/ledger', async (importActual) => ({
  ...(await importActual<typeof import('@/entities/ledger')>()),
  createLedger: (...args: unknown[]) => createLedger(...args),
}));

const groups = [
  { id: 'g1', code: 'BANK_ACCOUNTS', name: 'Bank Accounts' },
] as unknown as AccountGroup[];

function renderForm() {
  return render(
    <CreateLedgerForm
      companyId="c1"
      accountGroups={groups}
      currencies={[]}
      baseCurrency="INR"
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('creating a bank ledger', () => {
  beforeEach(() => {
    createLedger.mockReset();
    createLedger.mockResolvedValue({ id: 'l1' } as Ledger);
  });
  afterEach(cleanup);

  it('asks for the bank account only when the ledger type is BANK', () => {
    renderForm();
    expect(screen.queryByLabelText(/A\/c no\./)).toBeNull();

    type(/Ledger type/, 'BANK');

    expect(screen.getByLabelText(/A\/c holder name/)).toBeTruthy();
    expect(screen.getByLabelText(/A\/c no\./)).toBeTruthy();
    expect(screen.getByLabelText(/Bank code/)).toBeTruthy();
    expect(screen.getByLabelText(/Bank name & branch/)).toBeTruthy();
  });

  it('sends what was filled in, and leaves a blank field out', async () => {
    renderForm();
    type(/^Name/, 'HDFC Bank');
    type(/Ledger type/, 'BANK');
    type(/A\/c holder name/, ' Shah Traders ');
    type(/A\/c no\./, '50100123456789');
    type(/Bank code/, 'HDFC0001234');

    fireEvent.click(screen.getByRole('button', { name: 'Create ledger' }));

    await waitFor(() => expect(createLedger).toHaveBeenCalled());
    const sent = createLedger.mock.calls[0][1];
    expect(sent).toMatchObject({
      ledgerType: 'BANK',
      bankAccountHolderName: 'Shah Traders',
      bankAccountNumber: '50100123456789',
      bankCode: 'HDFC0001234',
    });
    expect(sent).not.toHaveProperty('bankName');
  });

  it('drops bank details typed before the type was changed away from BANK', async () => {
    renderForm();
    type(/^Name/, 'Office Rent');
    type(/Ledger type/, 'BANK');
    type(/A\/c no\./, '50100123456789');
    type(/Ledger type/, 'GENERAL');

    fireEvent.click(screen.getByRole('button', { name: 'Create ledger' }));

    await waitFor(() => expect(createLedger).toHaveBeenCalled());
    expect(createLedger.mock.calls[0][1]).not.toHaveProperty('bankAccountNumber');
  });
});
