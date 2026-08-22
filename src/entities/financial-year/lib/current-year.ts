import type { FinancialYear } from '../model/types';

/**
 * The financial year a company is currently working in.
 *
 * This mirrors the rule the reports API applies when no year is asked for: the year that contains
 * today, and failing that the last one on record. It has to mirror it exactly — the shell states
 * the year at the top of every screen, and a strip claiming 2019 over a 2026 balance sheet is worse
 * than saying nothing at all. That is not hypothetical: the shell used to read the company's own
 * `financialYearStart`, which is the *first* year it was ever given, not the one it is posting into.
 *
 * Dates are compared as calendar days in UTC, the way the API stores and resolves them, so a viewer
 * west of UTC does not fall into last year for the first hours of January.
 */
export function currentFinancialYear(years: FinancialYear[]): FinancialYear | null {
  if (years.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const containsToday = years.find(
    (year) => year.startDate.slice(0, 10) <= today && year.endDate.slice(0, 10) >= today,
  );

  return containsToday ?? years[years.length - 1];
}
