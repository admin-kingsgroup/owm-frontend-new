import { describe, it, expect } from 'vitest';

import type { Company, CompanyType } from '@/entities/company';

import type { VoucherType } from '@/entities/voucher-type';

import { buildMenus, periodQuery } from './menus';

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

const voucherType = (code: string, name: string, isActive = true) =>
  ({ id: code, companyId: 'c1', code, name, isActive }) as unknown as VoucherType;

const linksFor = (here: string, types: VoucherType[] = []) =>
  buildMenus('c1', company(), here, false, types)
    .flatMap((menu) => menu.items)
    .map((item) => item.to);

const reportLink = (here: string, report: string) =>
  linksFor(here).find((to) => to.includes(`report=${report}`));

/**
 * The period a report is read at is set once and used across several statements — it is Tally's
 * F2. It lives in the address, so every link between reports has to carry it or setting it means
 * retyping the dates at each step. These cover that, and the boundary either side of it: nothing
 * carried when there is nothing to carry, and nothing carried onto a link that is not a report.
 */
describe('periodQuery', () => {
  it('carries the dates and the comparison', () => {
    expect(periodQuery('/companies/c1/reports?report=cash-flow&from=2027-04-01&compare=true')).toBe(
      '&from=2027-04-01&compare=true',
    );
  });

  it('carries nothing when there is no query at all', () => {
    expect(periodQuery('/companies/c1/reports')).toBe('');
  });

  it('carries nothing when the query holds no period', () => {
    expect(periodQuery('/companies/c1?tab=settings')).toBe('');
  });

  it('leaves everything that is not the period behind', () => {
    // `report` is set by the link itself, and a stray `new=` would open a voucher form on arrival.
    const carried = periodQuery('/companies/c1/reports?report=day-book&new=RECEIPT&to=2028-03-31');

    expect(carried).toBe('&to=2028-03-31');
  });

  it('drops a comparison that is switched off rather than writing compare=false', () => {
    expect(periodQuery('/companies/c1/reports?report=cash-flow&compare=')).toBe('');
  });
});

describe('menu destinations', () => {
  const here = '/companies/c1/reports?report=cash-flow&from=2027-04-01&to=2028-03-31&compare=true';

  it('keeps the period when moving from one report to another', () => {
    expect(reportLink(here, 'profit-loss')).toBe(
      '/companies/c1/reports?report=profit-loss&from=2027-04-01&to=2028-03-31&compare=true',
    );
    expect(reportLink(here, 'trial-balance')).toBe(
      '/companies/c1/reports?report=trial-balance&from=2027-04-01&to=2028-03-31&compare=true',
    );
  });

  it('carries it onto reports that cannot compare, so it survives a detour through them', () => {
    // Day Book ignores the comparison, but passing through it must not throw the period away.
    expect(reportLink(here, 'day-book')).toContain('from=2027-04-01');
  });

  it('leaves a plain report link plain', () => {
    expect(reportLink('/companies/c1/reports?report=cash-flow', 'profit-loss')).toBe(
      '/companies/c1/reports?report=profit-loss',
    );
  });

  it('does not put a report period on links that are not reports', () => {
    const notReports = linksFor(here).filter((to) => !to.includes('report='));

    for (const to of notReports) {
      expect(to).not.toContain('from=2027-04-01');
    }
  });
});

/**
 * The registers and the Create list are written from the company's own voucher types. A fixed list
 * would offer a register for a type somebody had switched off and hide one they had invented,
 * which is the menu telling you about a product other than the one you are using.
 */
describe("menus built from the company's voucher types", () => {
  const types = [voucherType('SALES', 'Sales'), voucherType('CUSTOM', 'Site Transfer')];

  it('names a register for every type the company keeps', () => {
    const links = linksFor('/companies/c1/reports', types);

    expect(links).toContain('/companies/c1/reports?report=register&type=SALES');
    expect(links).toContain('/companies/c1/reports?report=register&type=CUSTOM');
  });

  it('offers a way to raise every one of them', () => {
    const links = linksFor('/companies/c1/reports', types);

    expect(links).toContain('/companies/c1/vouchers?new=SALES');
    expect(links).toContain('/companies/c1/vouchers?new=CUSTOM');
  });

  it('prints the key only where the shell actually binds one', () => {
    const items = buildMenus('c1', company(), '/companies/c1', false, types)
      .flatMap((menu) => menu.items)
      .filter((item) => item.to.includes('vouchers?new='));

    expect(items.find((item) => item.to.endsWith('SALES'))?.hint).toBe('F8');
    // A type the company invented has no binding, and a made-up one would eventually collide.
    expect(items.find((item) => item.to.endsWith('CUSTOM'))?.hint).toBeUndefined();
  });

  it('names no register at all while the types are still unknown', () => {
    // The reports screen's own picker is what answers in the meantime, so this is a shorter menu
    // rather than a dead end.
    expect(
      linksFor('/companies/c1/reports').filter((to) => to.includes('report=register')),
    ).toEqual([]);
  });

  it('stands the four every posting company has into Create while the list is unknown', () => {
    /*
      The strip beside the menu already offered them, so without this the two doors disagreed for
      as long as the one read of the types had not landed — which includes it having failed, and
      then for the rest of the session.
    */
    const created = buildMenus('c1', company(), '/companies/c1', false, [], false)
      .flatMap((menu) => menu.items)
      .filter((item) => item.to.includes('vouchers?new='))
      .map((item) => `${item.label} ${item.hint}`);

    expect(created).toEqual(['Contra F4', 'Payment F5', 'Receipt F6', 'Journal F7']);
  });

  it('still names no register while the list is unknown', () => {
    // Reports are not documents to raise: the reports screen's picker is what answers there.
    const links = buildMenus('c1', company(), '/companies/c1/reports', false, [], false)
      .flatMap((menu) => menu.items)
      .map((item) => item.to);

    expect(links.filter((to) => to.includes('report=register'))).toEqual([]);
  });

  it('offers nothing to raise once a company is known to hold no types', () => {
    // Switched every one of them off on purpose — four the form would refuse is the worse answer.
    const created = buildMenus('c1', company(), '/companies/c1', false, [], true)
      .flatMap((menu) => menu.items)
      .filter((item) => item.to.includes('vouchers?new='));

    expect(created).toEqual([]);
  });

  it('carries the period onto a register the same as any other report', () => {
    const links = linksFor('/companies/c1/reports?report=day-book&from=2027-04-01', types);

    expect(links).toContain('/companies/c1/reports?report=register&type=SALES&from=2027-04-01');
  });
});

/**
 * An analytics workspace measures other people's businesses and keeps no books of its own — no
 * voucher can ever reach it. Every accounting statement it could be offered is therefore one that
 * will be blank forever, and a menu bar that reliably opens blank screens is one nobody reads.
 */
describe('the menus an analytics workspace gets', () => {
  const portfolio = company({ type: 'ANALYTICS' as CompanyType });
  const menus = buildMenus('c1', portfolio, '/companies/c1', false, []);
  const ids = menus.map((menu) => menu.id);
  const every = menus.flatMap((menu) => menu.items);

  it('has no Reports menu at all', () => {
    expect(ids).not.toContain('reports');
    // And the bar is still a bar — dropping one menu must not drop the rest.
    expect(ids).toEqual(expect.arrayContaining(['dashboards', 'company', 'masters', 'help']));
  });

  it('offers the portfolio under Analysis, and nothing derived from statements it does not have', () => {
    const analysis = menus.find((menu) => menu.id === 'analysis')?.items ?? [];

    expect(analysis.map((item) => item.label)).toEqual(['Portfolio valuation']);
  });

  it('does not offer to verify books that do not exist', () => {
    const labels = every.map((item) => item.label);

    expect(labels).not.toContain('Verify books — trial balance');
    expect(labels).not.toContain('Opening balances');
  });

  it('opens no statement from anywhere on the bar', () => {
    // The whole bar, not just Reports — the same links used to be reachable from three menus.
    const reports = every
      .map((item) => /[?&]report=([^&]+)/.exec(item.to)?.[1])
      .filter((id): id is string => id !== undefined);

    /*
      The audit trail is the exception, and it earns it: it records account groups and financial
      years as well as vouchers, and an analytics workspace is seeded with both. Everything else is
      drawn from postings it will never have.
    */
    expect(reports).toEqual(['audit']);
  });

  it('offers the portfolio and every document the workspace actually holds', () => {
    /*
      Both, not one instead of the other. `ANALYTICS` was given four voucher types of its own —
      capital in, profit reported, profit shared out, a correction — and until this the menu named
      only the registry, so a workspace holding four documents offered no way to raise any of them.
    */
    const types = [
      voucherType('CAPITAL_INTRODUCTION', 'Capital Introduction'),
      voucherType('BUSINESS_PROFIT', 'Business Profit'),
      voucherType('PROFIT_ALLOCATION', 'Profit Allocation'),
      voucherType('ADJUSTMENT', 'Adjustment'),
    ];
    const transactions =
      buildMenus('c1', portfolio, '/companies/c1', false, types).find(
        (menu) => menu.id === 'transactions',
      )?.items ?? [];

    expect(transactions.map((item) => item.label)).toEqual([
      'Portfolio',
      'Vouchers',
      'Capital Introduction',
      'Business Profit',
      'Profit Allocation',
      'Adjustment',
    ]);
    expect(transactions.map((item) => item.hint)).toEqual([
      undefined,
      // Alt+V still reaches the registry for this kind of company, so Vouchers prints no key here.
      undefined,
      'F4',
      'F5',
      'F6',
      'F7',
    ]);
  });

  it("stands in the workspace's own four while its list is unknown, never the books'", () => {
    const created =
      buildMenus('c1', portfolio, '/companies/c1', false, [], false)
        .find((menu) => menu.id === 'transactions')
        ?.items.filter((item) => item.to.includes('raise=')) ?? [];

    // Contra and Payment here would be the menu naming documents this company certainly lacks.
    expect(created.map((item) => item.to.split('raise=')[1])).toEqual([
      'CAPITAL_INTRODUCTION',
      'BUSINESS_PROFIT',
      'PROFIT_ALLOCATION',
      'ADJUSTMENT',
    ]);
  });

  it('sends its four to the registry, never to a voucher form that would refuse them', () => {
    /*
      The accounts a workspace posts to are namespaced with a slash by the business registry, and
      the voucher API validates `ledgerCode` as `[A-Z0-9_]+`. The form fills, balances, and then
      answers `ledgerCode must be alphanumeric` on accept — a dead end reached only after the work
      is done. See raiseVoucherPath.
    */
    const types = [voucherType('CAPITAL_INTRODUCTION', 'Capital Introduction')];
    const created =
      buildMenus('c1', portfolio, '/companies/c1', false, types)
        .find((menu) => menu.id === 'transactions')
        ?.items.filter((item) => item.label === 'Capital Introduction') ?? [];

    expect(created.map((item) => item.to)).toEqual(['/companies/c1/kg?raise=CAPITAL_INTRODUCTION']);
  });

  it('still sends a company that keeps books to the voucher form', () => {
    const types = [voucherType('PAYMENT', 'Payment')];
    const created =
      buildMenus('c1', company(), '/companies/c1', false, types)
        .find((menu) => menu.id === 'transactions')
        ?.items.filter((item) => item.label === 'Payment') ?? [];

    expect(created.map((item) => item.to)).toEqual(['/companies/c1/vouchers?new=PAYMENT']);
  });

  it('still names the dashboard for what it is', () => {
    const dashboards = menus.find((menu) => menu.id === 'dashboards')?.items ?? [];

    expect(dashboards[0]?.label).toBe('Portfolio dashboard');
  });

  it('leaves a company that does keep books with every one of them', () => {
    const books = buildMenus('c1', company(), '/companies/c1', false, []);

    expect(books.map((menu) => menu.id)).toContain('reports');
    expect(
      books.flatMap((menu) => menu.items).filter((item) => item.to.includes('report=')).length,
    ).toBeGreaterThan(8);
  });
});
