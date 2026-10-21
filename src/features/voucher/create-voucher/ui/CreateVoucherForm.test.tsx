// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import type { Ledger } from '@/entities/ledger';
import type { VoucherType } from '@/entities/voucher-type';

import { CreateVoucherForm } from './CreateVoucherForm';

const voucherType = (code: string, name: string): VoucherType => ({
  id: `vt-${code}`,
  companyId: 'c1',
  code,
  name,
  category: code as VoucherType['category'],
  numberingMethod: 'AUTO',
  numbering: {
    prefix: '',
    suffix: '',
    numberLength: 4,
    startingNumber: 1,
    prefillWithZero: true,
    numberFormat: 'TALLY_STYLE',
    resetFrequency: 'YEARLY',
  },
  isSystem: true,
  isActive: true,
  configuration: {},
});

const ledger = (code: string, name: string): Ledger => ({
  id: `l-${code}`,
  companyId: 'c1',
  accountGroupId: 'g1',
  code,
  name,
  ledgerType: 'GENERAL',
  openingBalance: '0.00',
  openingBalanceType: 'DEBIT',
  maintainBillwise: false,
  isSystem: false,
  isActive: true,
});

const VOUCHER_TYPES = [
  voucherType('CONTRA', 'Contra'),
  voucherType('PAYMENT', 'Payment'),
  voucherType('RECEIPT', 'Receipt'),
];

const LEDGERS = [ledger('1402', 'HDFC Bank'), ledger('2201', 'Home Loan')];

function renderForm(patch: Partial<Parameters<typeof CreateVoucherForm>[0]> = {}) {
  return render(
    <CreateVoucherForm
      companyId="c1"
      voucherTypes={VOUCHER_TYPES}
      ledgers={LEDGERS}
      billWiseEnabled={false}
      multiCurrencyEnabled={false}
      currencies={[]}
      baseCurrency="INR"
      onCreated={() => {}}
      onCancel={() => {}}
      {...patch}
    />,
  );
}

/**
 * The voucher screen is where a month gets keyed in one sitting, so what is covered here is what
 * would cost someone that: opening on the wrong voucher type when a function key asked for one,
 * and the balance column showing a figure for the wrong account.
 */
describe('CreateVoucherForm', () => {
  afterEach(cleanup);

  it('opens on the voucher type a function key asked for', () => {
    renderForm({ initialVoucherTypeCode: 'RECEIPT' });

    expect(screen.getByRole('radio', { checked: true }).textContent).toMatch(/^Receipt/);
  });

  it("falls back to the first active type when the requested one is not this company's", () => {
    renderForm({ initialVoucherTypeCode: 'SALES' });

    expect(screen.getByRole('radio', { checked: true }).textContent).toMatch(/^Contra/);
  });

  it("shows each account's balance beside it, and follows the account when it changes", () => {
    renderForm({
      ledgerBalances: new Map([
        ['1402', '12,84,320.00 Dr'],
        ['2201', '42,90,000.00 Cr'],
      ]),
    });

    // Both rows start on the first ledger, so its balance is the one shown.
    expect(screen.getAllByText('12,84,320.00 Dr')).toHaveLength(2);

    const [firstLedgerSelect] = screen.getAllByRole('combobox');
    fireEvent.change(firstLedgerSelect, { target: { value: '2201' } });

    expect(screen.getByText('42,90,000.00 Cr')).toBeTruthy();
    expect(screen.getAllByText('12,84,320.00 Dr')).toHaveLength(1);
  });

  it('shows a dash rather than a wrong figure when the balances have not arrived', () => {
    renderForm();

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('totals each side and reports the difference that has to reach zero', () => {
    renderForm();
    const amounts = screen.getAllByRole('spinbutton');

    fireEvent.change(amounts[0], { target: { value: '1000' } });
    fireEvent.change(amounts[3], { target: { value: '600' } });

    expect(screen.getByText('Difference 400.00')).toBeTruthy();

    fireEvent.change(amounts[3], { target: { value: '1000' } });
    expect(screen.getByText('Difference 0.00')).toBeTruthy();
  });

  it('will neither post nor save a voucher whose sides disagree', () => {
    renderForm();
    const post = screen.getByRole('button', { name: /Post voucher/ }) as HTMLButtonElement;
    const draft = screen.getByRole('button', { name: /Save as draft/ }) as HTMLButtonElement;

    expect(post.disabled).toBe(true);
    expect(draft.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Enter the amounts');

    const amounts = screen.getAllByRole('spinbutton');
    fireEvent.change(amounts[0], { target: { value: '250' } });
    expect(screen.getByRole('status').textContent).toContain('Out by 250.00');

    fireEvent.change(amounts[3], { target: { value: '250' } });
    expect(post.disabled).toBe(false);
    expect(draft.disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toContain('Balanced');
  });

  it('switches the voucher type from its tab', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /Receipt/ }));
    expect(screen.getByRole('radio', { checked: true }).textContent).toMatch(/^Receipt/);
  });
});
