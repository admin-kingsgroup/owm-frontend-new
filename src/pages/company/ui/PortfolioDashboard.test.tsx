// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { Company, CompanyType } from '@/entities/company';
import type { Business, BusinessPerformance, PortfolioView } from '@/entities/kg';

import { PortfolioDashboard } from './PortfolioDashboard';

const performance = (patch: Partial<BusinessPerformance> = {}): BusinessPerformance => ({
  businessId: 'b1',
  businessName: 'KG Textiles',
  reportingCurrency: 'INR',
  revision: 1,
  turnover: '1200000.00',
  netProfit: '180000.00',
  netMarginPercent: '15.00',
  capitalEmployed: '900000.00',
  cumulativeCapitalInjected: '900000.00',
  roiPercent: '20.00',
  meetsRoiTarget: true,
  meetsMarginTarget: true,
  ...patch,
});

const view = (patch: Partial<PortfolioView> = {}): PortfolioView => ({
  periodYear: 2026,
  periodMonth: 8,
  portfolioCurrency: 'INR',
  targets: { roiPercentPerMonth: 5, netMarginPercentPerMonth: 10 },
  businesses: [performance()],
  businessesWithoutLockedSnapshot: [],
  totals: {
    businessCount: 1,
    turnover: '1200000.00',
    netProfit: '180000.00',
    cumulativeCapitalInjected: '900000.00',
    netMarginPercent: '15.00',
    roiPercent: '20.00',
  },
  ...patch,
});

const business = (patch: Partial<Business> = {}): Business => ({
  id: 'b1',
  companyId: 'c1',
  code: 'KG_TEXTILES',
  name: 'KG Textiles',
  reportingCurrency: 'INR',
  partners: [],
  isActive: true,
  ...patch,
});

const getRanking = vi.fn();
const listBusinesses = vi.fn();

vi.mock('@/entities/kg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/kg')>()),
  getRanking: (...args: unknown[]) => getRanking(...args),
  listBusinesses: (...args: unknown[]) => listBusinesses(...args),
}));

const company: Company = {
  id: 'c1',
  name: 'KG Business',
  code: 'KGB03',
  type: 'ANALYTICS' as CompanyType,
  financialYearStart: '2026-01-01T00:00:00.000Z',
  financialYearEnd: '2026-12-31T00:00:00.000Z',
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  initialized: true,
  seedVersion: 1,
  currentSeedVersion: 1,
  features: { billWiseDetails: false, multiCurrency: false },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <PortfolioDashboard company={company} />
    </MemoryRouter>,
  );
}

/**
 * The dashboard for a workspace that keeps no books of its own.
 *
 * What is covered is what would quietly mislead. A portfolio short of two businesses reads exactly
 * like a complete one; a total over nobody reads like a month of no trading; and a ratio with no
 * denominator, printed as 0%, reads like a result. Each of those is a number a person would act on.
 */
describe('PortfolioDashboard', () => {
  beforeEach(() => {
    getRanking.mockReset();
    listBusinesses.mockReset();
    getRanking.mockResolvedValue(view());
    listBusinesses.mockResolvedValue([business()]);
  });

  afterEach(cleanup);

  it('counts what the month is measured over, not what the registry holds today', async () => {
    /*
      The regression this exists for. A business that traded in April and has closed since still
      reported April, so the ranking counts it — while the registry no longer counts it as active.
      Taking the denominator from the registry read "3 of 2".
    */
    getRanking.mockResolvedValue(
      view({
        businesses: [
          performance({ businessId: 'b1', businessName: 'KG Textiles' }),
          performance({ businessId: 'b2', businessName: 'KG Exports' }),
          performance({ businessId: 'b3', businessName: 'KG Closed' }),
        ],
        businessesWithoutLockedSnapshot: ['KG Late'],
      }),
    );
    // Only two are still active, and one of those has not reported.
    listBusinesses.mockResolvedValue([business(), business({ id: 'b2', name: 'KG Exports' })]);

    renderDashboard();

    expect(await screen.findByText('3 of 4')).toBeTruthy();
    expect(screen.queryByText('3 of 2')).toBeNull();
  });

  it('names the businesses that have not reported, and says the totals exclude them', async () => {
    getRanking.mockResolvedValue(
      view({ businessesWithoutLockedSnapshot: ['KG Exports', 'KG Leather'] }),
    );

    renderDashboard();

    expect(await screen.findByText('KG Exports')).toBeTruthy();
    expect(screen.getByText('KG Leather')).toBeTruthy();
    expect(screen.getByText(/2 yet to report/)).toBeTruthy();
    expect(screen.getByText(/exclude them/)).toBeTruthy();
  });

  it('shows a dash, not nought, for a total over nobody', async () => {
    getRanking.mockResolvedValue(
      view({
        businesses: [],
        businessesWithoutLockedSnapshot: ['KG Textiles'],
        totals: {
          businessCount: 0,
          turnover: '0.00',
          netProfit: '0.00',
          cumulativeCapitalInjected: '0.00',
        },
      }),
    );

    renderDashboard();

    // "Turnover 0.00" is a claim about trading; the truth is that nobody has filed.
    expect(await screen.findByText(/Nothing locked for/)).toBeTruthy();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  it('tells an empty registry apart from a month nobody reported', async () => {
    getRanking.mockResolvedValue(
      view({
        businesses: [],
        businessesWithoutLockedSnapshot: [],
        totals: {
          businessCount: 0,
          turnover: '0.00',
          netProfit: '0.00',
          cumulativeCapitalInjected: '0.00',
        },
      }),
    );
    listBusinesses.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('No businesses in the registry yet')).toBeTruthy();
    expect(screen.queryByText(/Every business has reported/)).toBeNull();
  });

  it('leaves a ratio with no denominator unanswered rather than calling it nought', async () => {
    getRanking.mockResolvedValue(
      view({
        businesses: [
          performance({
            netMarginPercent: undefined,
            roiPercent: undefined,
            meetsRoiTarget: undefined,
            meetsMarginTarget: undefined,
          }),
        ],
      }),
    );

    renderDashboard();

    const league = await screen.findByRole('heading', { name: /League table/ });
    const table = league.parentElement as HTMLElement;

    // A business with no turnover did not miss a margin target; it had no margin to measure.
    expect(within(table).queryByText('0.0%')).toBeNull();
    expect(screen.queryByText('missed')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('says whether each business met its targets, in the targets actually in force', async () => {
    getRanking.mockResolvedValue(
      view({
        targets: { roiPercentPerMonth: 7, netMarginPercentPerMonth: 12 },
        businesses: [performance({ meetsRoiTarget: true, meetsMarginTarget: false })],
      }),
    );

    renderDashboard();

    // The server's own targets, not the defaults written into this screen — there are none.
    expect(await screen.findByText(/Return 7%/)).toBeTruthy();
    expect(screen.getByText(/Margin 12%/)).toBeTruthy();
    expect(screen.getByText('met')).toBeTruthy();
    expect(screen.getByText('missed')).toBeTruthy();
  });

  it('labels every figure in its tables, so a phone can stack them', async () => {
    getRanking.mockResolvedValue(view());

    const { container } = renderDashboard();
    // Named twice on purpose — once in the league table and once against its targets.
    expect((await screen.findAllByText('KG Textiles')).length).toBeGreaterThan(1);

    /*
      Below 48rem the header row is dropped and each cell is named by its own data-label. A cell
      that lost its label would render as an unnamed figure on a phone and read perfectly on the
      desktop this is written on, which is why it is asserted rather than looked at.
    */
    for (const table of container.querySelectorAll('table[data-stack]')) {
      const cells = table.querySelectorAll('tbody td');
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        expect(cell.getAttribute('data-label')).toBeTruthy();
      }
    }
  });

  it('says what went wrong rather than showing an empty portfolio', async () => {
    getRanking.mockRejectedValue(new Error('Ranking is unavailable'));

    renderDashboard();

    expect((await screen.findByRole('alert')).textContent).toContain('Ranking is unavailable');
  });

  it('keeps the registry count when the ranking fails, and the figures when the registry does', async () => {
    // Read together, either failing used to take the whole screen down with it.
    listBusinesses.mockRejectedValue(new Error('nope'));

    renderDashboard();

    // The ranking still arrived, so the figures are still drawn.
    expect((await screen.findAllByText('KG Textiles')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
