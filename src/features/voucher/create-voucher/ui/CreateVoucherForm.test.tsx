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
    // A Payment, because the form opens on Contra and Contra lists only cash and bank accounts.
    renderForm({
      initialVoucherTypeCode: 'PAYMENT',
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

  describe('a Contra voucher', () => {
    const typed = (code: string, name: string, ledgerType: Ledger['ledgerType']): Ledger => ({
      ...ledger(code, name),
      ledgerType,
    });
    const MIXED = [
      typed('CASH', 'Cash', 'CASH'),
      typed('FIN_CHARGES', 'Financial Charges', 'GENERAL'),
      typed('HDFC', 'HDFC Bank', 'BANK'),
      typed('ICICI', 'ICICI Bank', 'BANK'),
    ];
    const optionsOf = (select: HTMLElement) =>
      Array.from(select.querySelectorAll('option'), (option) => option.textContent);
    // Multi-currency is off here, so the only selects on the form are the account pickers.
    const ledgerSelects = () => screen.getAllByRole('combobox');

    it('offers only cash and bank accounts', () => {
      renderForm({ ledgers: MIXED, initialVoucherTypeCode: 'CONTRA' });
      expect(optionsOf(ledgerSelects()[0])).toEqual(['Cash', 'HDFC Bank', 'ICICI Bank']);
    });

    it('offers every account again on another voucher type', () => {
      renderForm({ ledgers: MIXED, initialVoucherTypeCode: 'PAYMENT' });
      expect(optionsOf(ledgerSelects()[0])).toEqual([
        'Cash',
        'Financial Charges',
        'HDFC Bank',
        'ICICI Bank',
      ]);
    });

    it('moves an empty line onto a bank account when switched to Contra', () => {
      renderForm({
        ledgers: [typed('FIN_CHARGES', 'Financial Charges', 'GENERAL'), ...MIXED.slice(2)],
        initialVoucherTypeCode: 'PAYMENT',
      });
      expect((ledgerSelects()[0] as HTMLSelectElement).value).toBe('FIN_CHARGES');

      fireEvent.click(screen.getByRole('radio', { name: /Contra/ }));
      expect((ledgerSelects()[0] as HTMLSelectElement).value).toBe('HDFC');
    });

    it('keeps a filled-in line on its account, flags it, and will not save it', () => {
      renderForm({
        ledgers: [typed('FIN_CHARGES', 'Financial Charges', 'GENERAL'), ...MIXED.slice(2)],
        initialVoucherTypeCode: 'PAYMENT',
      });
      const amounts = screen.getAllByPlaceholderText('0.00');
      fireEvent.change(amounts[0], { target: { value: '100' } });
      fireEvent.change(ledgerSelects()[1], { target: { value: 'HDFC' } });
      fireEvent.change(amounts[3], { target: { value: '100' } });

      fireEvent.click(screen.getByRole('radio', { name: /Contra/ }));

      const first = ledgerSelects()[0] as HTMLSelectElement;
      expect(first.value).toBe('FIN_CHARGES');
      expect(first.selectedOptions[0].textContent).toBe('Financial Charges — not cash or bank');

      fireEvent.click(screen.getByRole('button', { name: /Post voucher/ }));
      expect(screen.getByText(/moves money between cash and bank accounts only/)).toBeTruthy();
    });

    it('says why the list is empty when the company has no cash or bank account', () => {
      renderForm({
        ledgers: [typed('FIN_CHARGES', 'Financial Charges', 'GENERAL')],
        initialVoucherTypeCode: 'CONTRA',
      });
      expect(screen.getByRole('note').textContent).toMatch(/type CASH or BANK/);
    });
  });

  it('lists each account by its name alone, adding the code only to tell two of a name apart', () => {
    renderForm({
      ledgers: [
        ledger('HDFC_BANK_AC_5010088', 'HDFC Bank - A/c.: 50100884698393'),
        ledger('SUSPENSE', 'Suspense'),
        ledger('SUSPENSE_2', 'suspense '),
      ],
      initialVoucherTypeCode: 'PAYMENT',
    });

    const options = Array.from(
      screen.getAllByRole('combobox')[0].querySelectorAll('option'),
      (option) => option.textContent,
    );
    expect(options).toEqual([
      'HDFC Bank - A/c.: 50100884698393',
      'Suspense (SUSPENSE)',
      'suspense  (SUSPENSE_2)',
    ]);
  });
});
