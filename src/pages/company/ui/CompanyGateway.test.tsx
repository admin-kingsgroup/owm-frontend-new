// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { Company } from '@/entities/company';
import type { CompanyContext } from '@/entities/report';
import type { VoucherType } from '@/entities/voucher-type';

import { CompanyGateway } from './CompanyGateway';

const balanceSheet = {
  period: {
    financialYearId: 'fy',
    financialYearLabel: '2026-2027',
    financialYearStatus: 'OPEN' as const,
    from: '2026-04-01T00:00:00.000Z',
    to: '2027-03-31T00:00:00.000Z',
  },
  comparison: null,
  assets: [
    {
      kind: 'group' as const,
      id: 'a1',
      code: '1400',
      name: 'Current Assets',
      debit: '0',
      credit: '0',
      balance: '1842650.00',
      balanceSide: 'DEBIT' as const,
    },
    /*
      An account rather than a group, which a chart is free to put at this level. It is here because
      the two are opened by different reports and the row has to tell them apart — the first version
      of that link sent every row's id as a group's.
    */
    {
      kind: 'ledger' as const,
      id: 'a2',
      code: 'PETTY',
      name: 'Petty Cash',
      debit: '0',
      credit: '0',
      balance: '5000.00',
      balanceSide: 'DEBIT' as const,
    },
  ],
  liabilities: [
    {
      kind: 'group' as const,
      id: 'l1',
      code: '2200',
      name: 'Loans (Liability)',
      debit: '0',
      credit: '0',
      balance: '-4290000.00',
      balanceSide: 'CREDIT' as const,
    },
  ],
  totals: {
    assets: '1842650.00',
    liabilities: '4290000.00',
    currentPeriodProfit: '0.00',
    difference: '0.00',
  },
};

vi.mock('@/entities/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/report')>()),
  getBalanceSheet: vi.fn(async () => balanceSheet),
}));

/** The frame holds the readout; the gateway reads it rather than asking for it again. */
let readout: CompanyContext | null = null;
vi.mock('@/widgets/app-shell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/widgets/app-shell')>()),
  useCompanyReadout: () => ({ context: readout, refresh: () => {} }),
}));

const company: Company = {
  id: 'c1',
  name: 'ADB - INR',
  code: 'ADBINR',
  type: 'PERSONAL',
  financialYearStart: '2026-04-01T00:00:00.000Z',
  financialYearEnd: '2027-03-31T00:00:00.000Z',
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  initialized: true,
  seedVersion: 1,
  features: {
    billWiseDetails: true,
    multiCurrency: false,
  },
};

const voucherType = (code: string, name: string, isActive = true): VoucherType => ({
  id: `vt-${code}`,
  companyId: 'c1',
  code,
  name,
  category: 'PAYMENT',
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
  isActive,
  configuration: {},
});

const context = (patch: Partial<CompanyContext> = {}): CompanyContext => ({
  period: balanceSheet.period,
  difference: '0.00',
  draftVouchers: 0,
  ...patch,
});

function renderGateway(types: VoucherType[] = [voucherType('PAYMENT', 'Payment')]) {
  return render(
    <MemoryRouter>
      <CompanyGateway company={company} voucherTypes={types} />
    </MemoryRouter>,
  );
}

/**
 * The company's front door. What is covered is what would quietly mislead: a balance summary that
 * does not say which figures are debts, and an attention list that stays silent about books which
 * do not balance.
 */
describe('CompanyGateway', () => {
  afterEach(() => {
    readout = null;
    cleanup();
  });

  it('offers the masters as a way in, and does not repeat the voucher types', () => {
    renderGateway([voucherType('PAYMENT', 'Payment'), voucherType('SALES', 'Sales', false)]);

    expect(screen.getByRole('link', { name: /Groups & ledgers/ }).getAttribute('href')).toBe(
      '/companies/c1?tab=accounts',
    );
    /*
      Raising a voucher belongs to the function-key strip, which is on screen everywhere rather than
      only here. The dashboard listing the same types again was the same menu printed twice on one
      page, and it taught that data entry starts by coming back to the dashboard.
    */
    expect(screen.queryByRole('link', { name: 'Payment' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Sales/ })).toBeNull();
  });

  it('hides currencies from a company that does not keep more than one', () => {
    renderGateway();
    expect(screen.queryByRole('link', { name: /Currencies/ })).toBeNull();
  });

  it('says which figures are holdings and which are debts', async () => {
    renderGateway();

    expect(await screen.findByText('Current Assets')).toBeTruthy();
    expect(screen.getByText('Assets')).toBeTruthy();
    expect(screen.getByText('Liabilities')).toBeTruthy();
    // The side is stated on every row, not left to the sign in front of the figure. Counted rather
    // than matched once: the holdings side now carries more than one row.
    expect(screen.getAllByText('Dr').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cr').length).toBeGreaterThan(0);
    expect(screen.getByText('Net worth')).toBeTruthy();
  });

  it('opens each balance in the report that can actually show it', async () => {
    renderGateway();

    expect((await screen.findByRole('link', { name: 'Current Assets' })).getAttribute('href')).toBe(
      '/companies/c1/reports?report=monthly-summary&groupId=a1',
    );
    // An account has no group summary; its statement is the ledger report.
    expect(screen.getByRole('link', { name: 'Petty Cash' }).getAttribute('href')).toBe(
      '/companies/c1/reports?report=ledger&ledgerId=a2',
    );
  });

  it('stays quiet when there is nothing outstanding', async () => {
    readout = context();
    renderGateway();

    expect(await screen.findByText(/Nothing outstanding/)).toBeTruthy();
  });

  it('raises drafts, a difference and a closed year — each once', async () => {
    readout = context({
      draftVouchers: 6,
      difference: '400.00',
      period: { ...balanceSheet.period, financialYearStatus: 'CLOSED' },
    });
    renderGateway();

    expect(await screen.findByText(/6 draft vouchers awaiting post/)).toBeTruthy();
    expect(screen.getByText(/debits do not equal credits/)).toBeTruthy();
    expect(screen.getByText(/is closed to new vouchers/)).toBeTruthy();
    expect(screen.queryByText(/Nothing outstanding/)).toBeNull();
  });

  it('says voucher, not vouchers, when there is one', async () => {
    readout = context({ draftVouchers: 1 });
    renderGateway();

    expect(await screen.findByText(/1 draft voucher awaiting post/)).toBeTruthy();
  });
});
