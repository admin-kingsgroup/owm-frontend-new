import { describe, it, expect } from 'vitest';

import type { Company } from '@/entities/company';

import { buildNav, screenName } from './nav';

const books = { type: 'PERSONAL' } as Company;
const workspace = { type: 'ANALYTICS' } as Company;

const labels = (items: ReturnType<typeof buildNav>) => items.map((item) => item.label);
const current = (items: ReturnType<typeof buildNav>) =>
  items.filter((item) => item.active).map((item) => item.label);

describe('buildNav', () => {
  it('offers only the group overview outside a company', () => {
    expect(labels(buildNav(undefined, null, '/companies', ''))).toEqual(['Group overview']);
  });

  it('gives a set of books Reports and a workspace Portfolio, never both', () => {
    const forBooks = labels(buildNav('c1', books, '/companies/c1', ''));
    const forWorkspace = labels(buildNav('c1', workspace, '/companies/c1', ''));

    expect(forBooks).toContain('Reports');
    expect(forBooks).not.toContain('Portfolio');
    expect(forWorkspace).toContain('Portfolio');
    expect(forWorkspace).not.toContain('Reports');
  });

  it('does not print Alt+V against Vouchers where it opens the portfolio', () => {
    const items = buildNav('c1', workspace, '/companies/c1', '');
    expect(items.find((item) => item.id === 'vouchers')?.hint).toBeUndefined();
    expect(items.find((item) => item.id === 'portfolio')?.hint).toBe('Alt+V');
  });

  it('tells the dashboard from a master screen on the same path', () => {
    expect(current(buildNav('c1', books, '/companies/c1', ''))).toEqual(['Dashboard']);
    expect(current(buildNav('c1', books, '/companies/c1', '?tab=parties'))).toEqual(['Masters']);
  });

  it('marks the audit trail, not Reports, when the audit report is open', () => {
    expect(current(buildNav('c1', books, '/companies/c1/reports', '?report=audit'))).toEqual([
      'Audit trail',
    ]);
    expect(
      current(buildNav('c1', books, '/companies/c1/reports', '?report=balance-sheet')),
    ).toEqual(['Reports']);
  });

  it('lists reported errors for an administrator only', () => {
    expect(labels(buildNav('c1', books, '/companies/c1', '', true))).toContain('Reported errors');
    expect(labels(buildNav('c1', books, '/companies/c1', '', false))).not.toContain(
      'Reported errors',
    );
  });
});

describe('screenName', () => {
  it('names the screen that is open', () => {
    expect(screenName('/companies', '')).toBe('Group overview');
    expect(screenName('/companies/c1', '', 'c1')).toBe('Dashboard');
    expect(screenName('/companies/c1', '?tab=accounts', 'c1')).toBe('Masters');
    expect(screenName('/companies/c1/reports', '?report=audit', 'c1')).toBe('Audit trail');
    expect(screenName('/companies/c1/kg', '', 'c1')).toBe('Portfolio');
  });
});
