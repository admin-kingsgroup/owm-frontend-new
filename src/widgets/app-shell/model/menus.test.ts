import { describe, it, expect } from 'vitest';

import type { Company, CompanyType } from '@/entities/company';

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
  features: {
    billWiseDetails: true,
    multiCurrency: true,
    costCentres: false,
    inventory: false,
    gst: false,
  },
  ...patch,
});

const linksFor = (here: string) =>
  buildMenus('c1', company(), here)
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
