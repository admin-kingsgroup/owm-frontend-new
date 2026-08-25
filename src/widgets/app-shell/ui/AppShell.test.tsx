// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useCompanyStore } from '@/entities/company';
import type { Company, CompanyType } from '@/entities/company';
import type { VoucherType } from '@/entities/voucher-type';

import { useButtonBar } from '../model/button-bar';
import { AppShell } from './AppShell';

/**
 * The context strip reads its year and its difference from the server, not from the company record
 * — `financialYearStart` there is the first year the company was ever given, not the one it is
 * posting into. So the strip renders nothing until those calls resolve, and a test that stubs
 * neither asserts against an empty strip.
 *
 * Only the two network calls are stubbed. `currentFinancialYear` stays real, because which year it
 * picks out of the list is the logic worth exercising here rather than replacing.
 */
vi.mock('@/entities/financial-year', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/financial-year')>()),
  listFinancialYears: vi.fn(async () => [
    {
      id: 'fy-2026',
      companyId: 'c1',
      // As the server writes it. An April-to-March year straddles two, and says so.
      label: '2026-2027',
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2027-03-31T00:00:00.000Z',
      status: 'OPEN' as const,
    },
  ]),
}));

vi.mock('@/entities/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/report')>()),
  /**
   * The strip reads the company context, not a trial balance — one call that answers which year is
   * being posted into, whether the books balance, and how many drafts are waiting. Stubbing the
   * older call left `period` undefined and the year never appeared.
   */
  getCompanyContext: vi.fn(async () => ({
    period: {
      financialYearId: 'fy-2026',
      // As the server writes it. An April-to-March year straddles two, and says so.
      financialYearLabel: '2026-2027',
      financialYearStatus: 'OPEN' as const,
      from: '2026-04-01T00:00:00.000Z',
      to: '2027-03-31T00:00:00.000Z',
    },
    difference: '0.00',
    draftVouchers: 0,
  })),
}));

/**
 * The company's voucher types, which the Transactions menu and the button bar are both built from.
 *
 * Deliberately not the eight the function-key table names: a personal book keeps six, and one of
 * those is a type this company invented, which has no key and is exactly the case the bar used to
 * leave out altogether.
 */
const voucherType = (code: string, name: string): VoucherType => ({
  id: `vt-${code}`,
  companyId: 'c1',
  code,
  name,
  category: 'PAYMENT',
  numberingMethod: 'AUTO',
  numbering: {
    prefix: '',
    suffix: '',
    numberLength: 6,
    prefillWithZero: true,
    numberFormat: 'TALLY_STYLE',
    resetFrequency: 'YEARLY',
    startingNumber: 1,
  },
  isSystem: true,
  isActive: true,
  configuration: {},
});

/** Alphabetical, as the server answers — so the ordering the bar applies is actually exercised. */
const PERSONAL_TYPES = [
  voucherType('CONTRA', 'Contra'),
  voucherType('EXPENSE', 'Expense'),
  voucherType('INCOME', 'Income'),
  voucherType('JOURNAL', 'Journal'),
  voucherType('PAYMENT', 'Payment'),
  voucherType('PETTY_CASH', 'Petty Cash'),
  voucherType('RECEIPT', 'Receipt'),
];

/** Reassigned by the one test that needs a different set of books. */
let heldTypes = PERSONAL_TYPES;

vi.mock('@/entities/voucher-type', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/voucher-type')>()),
  listVoucherTypes: vi.fn(async () => heldTypes),
}));

const company = (patch: Partial<Company> = {}): Company => ({
  id: 'c1',
  name: 'ADB - INR',
  code: 'ADBINR',
  type: 'PERSONAL' as CompanyType,
  financialYearStart: '2026-04-01T00:00:00.000Z',
  financialYearEnd: '2027-03-31T00:00:00.000Z',
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  initialized: true,
  seedVersion: 1,
  currentSeedVersion: 1,
  features: {
    billWiseDetails: true,
    multiCurrency: true,
  },
  ...patch,
});

/** Echoes the current URL, so a menu choice can be checked by where it actually went. */
function Here() {
  const location = useLocation();
  return <div data-testid="here">{`${location.pathname}${location.search}`}</div>;
}

/** A screen that contributes to the button bar, as a real page does. */
function ScreenWithActions({ onFire }: { onFire: () => void }) {
  useButtonBar([
    { group: 'This report', key: 'Ctrl+E', label: 'Export CSV', onSelect: onFire },
    { group: 'This report', key: 'F8', label: 'Recalculate', onSelect: onFire },
  ]);
  return (
    <div>
      <Here />
      <input aria-label="period" />
    </div>
  );
}

function renderShell(options: { companies?: Company[] | null; screen?: React.ReactNode } = {}) {
  useCompanyStore.setState({
    companies: options.companies === undefined ? [company()] : options.companies,
    loaded: true,
    error: null,
    loading: false,
  });

  return render(
    <MemoryRouter initialEntries={['/companies/c1/reports']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/companies/:companyId/reports" element={options.screen ?? <Here />} />
          {/* Where the data-entry actions point. Without it, following one lands on no route at
              all and the assertion reads as the action having done nothing. */}
          <Route path="/companies/:companyId/vouchers" element={<Here />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const openMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

/**
 * The shell is the whole navigation model of the product now — a menu bar, a context strip and a
 * button bar of shortcuts. These cover what would silently stop working: a menu item pointing at
 * the wrong report, a feature-gated report appearing for a company that cannot produce it, and a
 * shortcut stealing a keystroke from a field someone is typing in.
 */
describe('AppShell', () => {
  beforeEach(() => {
    heldTypes = PERSONAL_TYPES;
    useCompanyStore.setState({ companies: null, loaded: false, error: null, loading: false });
  });

  afterEach(cleanup);

  it('carries the whole product in four menus', () => {
    renderShell();

    for (const label of ['Company', 'Masters', 'Transactions', 'Reports']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('opens a menu with its mnemonic and closes it again', () => {
    renderShell();

    fireEvent.keyDown(document, { code: 'KeyR', altKey: true });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Balance Sheet/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    // Focus goes back to the menu it came from, not to the top of the page.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reports' }));
  });

  it('labels each group in the button bar, so its actions are read together', () => {
    renderShell();

    const group = screen.getByRole('group', { name: 'Go to' });
    expect(group.querySelectorAll('button').length).toBeGreaterThan(1);
  });

  it('links each report at its own address, not just at the reports page', () => {
    renderShell();
    openMenu('Reports');

    fireEvent.click(screen.getByRole('menuitem', { name: /Trial Balance/ }));

    expect(screen.getByTestId('here').textContent).toBe(
      '/companies/c1/reports?report=trial-balance',
    );
    // Following a link closes the bar rather than leaving it over the new screen.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('marks only the report actually open as current', () => {
    renderShell();
    openMenu('Reports');
    fireEvent.click(screen.getByRole('menuitem', { name: /Profit & Loss/ }));
    openMenu('Reports');

    const current = screen.getAllByRole('menuitem').filter((item) => item.ariaCurrent === 'true');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Profit & Loss');
  });

  it('drops the reports a company cannot produce', () => {
    renderShell({
      companies: [
        company({
          features: {
            billWiseDetails: false,
            multiCurrency: false,
          },
        }),
      ],
    });
    openMenu('Reports');

    expect(screen.queryByRole('menuitem', { name: /Receivables/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Forex/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Balance Sheet/ })).toBeTruthy();

    openMenu('Company');
    expect(screen.queryByRole('menuitem', { name: /Currencies/ })).toBeNull();
  });

  it('offers an analytics workspace the portfolio and its own four documents', () => {
    /*
      Both, not one instead of the other. The registry is what the workspace is mostly for, and it
      also posts now — capital in, profit reported, profit shared out and a correction — so a menu
      naming only the registry left four seeded documents with no way to raise any of them.

      No key printed against Vouchers here: Alt+V still reaches the portfolio for this kind of
      company, and a menu naming a key that does something else is worse than one naming none.
    */
    renderShell({ companies: [company({ type: 'ANALYTICS' })] });
    openMenu('Transactions');

    expect(screen.getByRole('menuitem', { name: 'Portfolio' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Vouchers' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Capital Introduction/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Business Profit/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Profit Allocation/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Adjustment/ })).toBeTruthy();
  });

  it('states the year and currency once for the whole app', async () => {
    renderShell();

    /*
      The company is named by the switcher, not by this strip — once, at the top right, where it is
      also the control that changes it. The strip carries only what is stated nowhere else.
    */
    expect(screen.getByRole('button', { name: /ADB - INR/ })).toBeTruthy();
    expect(screen.queryByText('ADB - INR', { selector: 'b' })).toBeNull();
    // The label exactly as the server wrote it: the strip prints it rather than reformatting, so
    // what is on screen and what the reports API answers with can never drift apart.
    expect(await screen.findByText('2026-2027')).toBeTruthy();
    expect(screen.getByText('INR')).toBeTruthy();
  });

  it('renders nothing of the context strip until the company list arrives', () => {
    renderShell({ companies: null });

    expect(screen.queryByText('ADB - INR')).toBeNull();
    // The menus still stand, so the shell is never a blank frame.
    expect(screen.getByRole('button', { name: 'Company' })).toBeTruthy();
  });

  describe('button bar', () => {
    it("shows the open screen's actions alongside the shell's own", () => {
      renderShell({ screen: <ScreenWithActions onFire={() => {}} /> });

      expect(screen.getByRole('button', { name: /Export CSV/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Recalculate/ })).toBeTruthy();
      // The shell contributes the way out of every screen.
      expect(screen.getByRole('button', { name: /Balance Sheet/ })).toBeTruthy();
    });

    it('runs an action from its shortcut', () => {
      let fired = 0;
      renderShell({ screen: <ScreenWithActions onFire={() => (fired += 1)} /> });

      fireEvent.keyDown(document, { key: 'F8' });
      expect(fired).toBe(1);

      fireEvent.keyDown(document, { code: 'KeyE', ctrlKey: true });
      expect(fired).toBe(2);
    });

    it('leaves a letter shortcut alone while someone is typing', () => {
      let fired = 0;
      renderShell({ screen: <ScreenWithActions onFire={() => (fired += 1)} /> });
      const field = screen.getByLabelText('period');

      fireEvent.keyDown(field, { code: 'KeyE', ctrlKey: true });
      expect(fired).toBe(0);

      // A function key types nothing, so it still works from inside the field.
      fireEvent.keyDown(field, { key: 'F8' });
      expect(fired).toBe(1);
    });

    it('stands down while a dialog is open, so a shortcut cannot discard what is in it', () => {
      let fired = 0;
      renderShell({ screen: <ScreenWithActions onFire={() => (fired += 1)} /> });

      // The voucher form and every other modal render one of these.
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.append(dialog);

      fireEvent.keyDown(document, { key: 'F8' });
      fireEvent.keyDown(document, { code: 'KeyR', altKey: true });

      expect(fired).toBe(0);
      expect(screen.queryByRole('menu')).toBeNull();

      dialog.remove();
      fireEvent.keyDown(document, { key: 'F8' });
      expect(fired).toBe(1);
    });

    it('ignores a held-down key repeating', () => {
      let fired = 0;
      renderShell({ screen: <ScreenWithActions onFire={() => (fired += 1)} /> });

      fireEvent.keyDown(document, { key: 'F8' });
      fireEvent.keyDown(document, { key: 'F8', repeat: true });

      expect(fired).toBe(1);
    });

    it('goes where a shell action points', () => {
      renderShell();

      fireEvent.click(screen.getByRole('button', { name: /Balance Sheet/ }));

      expect(screen.getByTestId('here').textContent).toBe(
        '/companies/c1/reports?report=balance-sheet',
      );
    });

    /*
      The bar is the only way into data entry that is on screen wherever you are, so a document
      missing from it is a document you have to go to the Gateway to raise. It used to be built
      from the fixed function-key table, which meant a type the company created was silently
      absent — the fault this covers.
    */
    it('offers every voucher type the company holds, in the order the keys run', async () => {
      renderShell();

      const group = await screen.findByRole('group', { name: 'Data entry' });
      const rows = [...group.querySelectorAll('button')].map((button) => button.textContent);

      // Label then key, as the markup writes them; the strip prints the key first with `order`.
      expect(rows).toEqual([
        'ContraF4',
        'PaymentF5',
        'ReceiptF6',
        'JournalF7',
        'IncomeF8',
        'ExpenseF9',
        // The company's own type: no key to give it, and a button all the same.
        'Petty Cash',
      ]);
    });

    /*
      Income and Expense share F8 and F9 with Sales and Purchase deliberately — a company is either
      trading or personal, so seeding can never produce both. A company is free to create its own
      type under either code, and then the strip would print F8 twice while only the first of them
      answered the key.
    */
    it('never prints the same key twice, whatever the company holds', async () => {
      heldTypes = [
        voucherType('SALES', 'Sales'),
        voucherType('INCOME', 'Consulting income'),
        voucherType('PAYMENT', 'Payment'),
      ];
      renderShell();

      const group = await screen.findByRole('group', { name: 'Data entry' });
      const rows = [...group.querySelectorAll('button')].map((button) => button.textContent);

      // Sales holds F8 because it comes first in key order; the invented type keeps its button.
      expect(rows).toEqual(['PaymentF5', 'SalesF8', 'Consulting income']);
    });

    /*
      The fallback exists for a list that is not known — still being read, or read and failed — so
      the bar is never without a way to enter a voucher. A company that has switched every one of
      its types off is the opposite case: it can raise nothing, and offering it four documents the
      form will refuse is the bar claiming a company can do something it cannot.
    */
    it('offers nothing to a company that has switched every voucher type off', async () => {
      heldTypes = [];
      renderShell();

      await waitFor(() => expect(screen.queryByRole('group', { name: 'Data entry' })).toBeNull());
      // The rest of the bar is unaffected — there is still a way out of the screen.
      expect(screen.getByRole('group', { name: 'Go to' })).toBeTruthy();
    });

    it('raises the company’s own voucher type from the bar', async () => {
      renderShell();

      fireEvent.click(await screen.findByRole('button', { name: 'Petty Cash' }));

      expect(screen.getByTestId('here').textContent).toBe('/companies/c1/vouchers?new=PETTY_CASH');
    });
  });
});
