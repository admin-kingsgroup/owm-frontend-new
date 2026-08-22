import { describe, it, expect, vi, afterEach } from 'vitest';

import { currentFinancialYear } from './current-year';
import type { FinancialYear } from '../model/types';

const year = (label: string, startDate: string, endDate: string): FinancialYear => ({
  id: `fy-${label}`,
  companyId: 'c1',
  label,
  startDate: `${startDate}T00:00:00.000Z`,
  endDate: `${endDate}T00:00:00.000Z`,
  status: 'OPEN',
});

const YEARS = [
  year('2019', '2019-01-01', '2019-12-31'),
  year('2025', '2025-01-01', '2025-12-31'),
  year('2026', '2026-01-01', '2026-12-31'),
];

/**
 * The shell states this year at the top of every screen, so it has to agree with the year the
 * reports API picks when it is not told which one to use. These are the cases where the two could
 * drift apart — and the first one is the bug this replaced: reading the company's own start date
 * gave 2019, the first year it was ever given, while the books were being kept in 2026.
 */
describe('currentFinancialYear', () => {
  afterEach(() => vi.useRealTimers());

  const on = (day: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${day}T09:00:00.000Z`));
  };

  it('picks the year that contains today, not the first one on record', () => {
    on('2026-08-22');
    expect(currentFinancialYear(YEARS)?.label).toBe('2026');
  });

  it('picks an earlier year while today is inside it', () => {
    on('2025-06-30');
    expect(currentFinancialYear(YEARS)?.label).toBe('2025');
  });

  it('falls back to the last year when today is past every one of them', () => {
    on('2031-01-05');
    expect(currentFinancialYear(YEARS)?.label).toBe('2026');
  });

  it('falls back to the last year when today is before every one of them', () => {
    on('2001-01-05');
    expect(currentFinancialYear(YEARS)?.label).toBe('2026');
  });

  it('holds on the first and last days of a year, either side of UTC', () => {
    on('2026-01-01');
    expect(currentFinancialYear(YEARS)?.label).toBe('2026');
    on('2026-12-31');
    expect(currentFinancialYear(YEARS)?.label).toBe('2026');
  });

  it('has nothing to say about a company with no years', () => {
    expect(currentFinancialYear([])).toBeNull();
  });
});
