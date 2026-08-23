// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useCompanyStore } from '@/entities/company';
import type { Company, CompanyType } from '@/entities/company';
import type { GroupOverview } from '@/entities/report';

const getGroupOverview = vi.fn();

vi.mock('@/entities/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/report')>()),
  getGroupOverview: () => getGroupOverview(),
}));

const { CompaniesPage } = await import('./CompaniesPage');

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
  features: {
    billWiseDetails: true,
    multiCurrency: true,
  },
  ...patch,
});

const overview = (totals: Partial<GroupOverview['totals']> = {}): GroupOverview => ({
  companies: [],
  totals: {
    byCurrency: [{ currency: 'INR', cashAndBank: '1000.00', netProfit: '250.00' }],
    draftVoucherCount: 0,
    companyCount: 2,
    openYearCount: 2,
    inactiveCount: 0,
    ...totals,
  },
});

function renderPage(companies: Company[]) {
  useCompanyStore.setState({
    companies,
    loaded: true,
    error: null,
    loading: false,
    load: async () => {},
  });

  return render(
    <MemoryRouter>
      <CompaniesPage />
    </MemoryRouter>,
  );
}

/**
 * The overview strip is the first thing an owner reads, and every figure on it is a sum over a
 * population that is not obvious: active companies only, never across currencies. These cover the
 * ways that sum can mislead — restating a single company's own card, silently dropping a
 * deactivated company from the count with nothing to say so, and adding two currencies together.
 */
describe('CompaniesPage overview', () => {
  beforeEach(() => {
    getGroupOverview.mockReset();
    useCompanyStore.setState({ companies: null, loaded: false, error: null, loading: false });
  });

  afterEach(cleanup);

  it('does not restate a single company back to itself', async () => {
    getGroupOverview.mockResolvedValue(overview({ companyCount: 1, openYearCount: 1 }));
    renderPage([company()]);

    // The counts still earn a slot, because the card below does not carry them.
    await screen.findByText('Open years');
    expect(screen.queryByText('Cash & bank')).toBeNull();
  });

  it('names the currency on every figure once there is more than one', async () => {
    getGroupOverview.mockResolvedValue(
      overview({
        byCurrency: [
          { currency: 'INR', cashAndBank: '1000.00', netProfit: '250.00' },
          { currency: 'USD', cashAndBank: '80.00', netProfit: '-20.00' },
        ],
      }),
    );
    renderPage([company(), company({ id: 'c2', baseCurrency: 'USD', country: 'US' })]);

    // Two currencies are never summed, so each figure has to say which one it is.
    await screen.findByText('Cash & bank · INR');
    expect(screen.getByText('Cash & bank · USD')).toBeTruthy();
    expect(screen.getByText('Net profit · USD')).toBeTruthy();
  });

  it('leaves the currency off when the whole group is in one', async () => {
    getGroupOverview.mockResolvedValue(overview());
    renderPage([company(), company({ id: 'c2' })]);

    await screen.findByText('Cash & bank');
    expect(screen.queryByText('Cash & bank · INR')).toBeNull();
  });

  it('says when a company is being left out of the totals', async () => {
    getGroupOverview.mockResolvedValue(overview({ inactiveCount: 1 }));
    renderPage([company(), company({ id: 'c2' })]);

    // Otherwise the strip and the list below simply disagree, with nothing to explain why.
    await screen.findByText('Deactivated');
    expect(screen.getByText('1 · not counted')).toBeTruthy();
  });

  it('keeps the slot out of the way when nothing is deactivated', async () => {
    getGroupOverview.mockResolvedValue(overview());
    renderPage([company(), company({ id: 'c2' })]);

    await screen.findByText('Open years');
    expect(screen.queryByText('Deactivated')).toBeNull();
  });

  it('still lists the companies when the figures cannot be read', async () => {
    getGroupOverview.mockRejectedValue(new Error('upstream is down'));
    renderPage([company(), company({ id: 'c2', name: 'ADB - USD', code: 'ADBUSD' })]);

    // A degraded page, not a broken one: the figures failing must not take the list down with it.
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain('listed without their balances');
    expect(screen.getByText('ADB - USD')).toBeTruthy();
  });
});
