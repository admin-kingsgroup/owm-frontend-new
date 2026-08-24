import { describe, it, expect } from 'vitest';

import { periodOf, type LoadedReports } from './export-report';
import { TAB_IDS, type Tab } from './tabs';

/**
 * The dates printed above a statement.
 *
 * `periodOf` decides them, and it is the one function here whose mistakes are silent: a wrong
 * mapping does not throw or blank the screen, it prints one report's dates over another report's
 * figures, in the same confident grey as the right ones. These cases exist because reports stay in
 * state once read — the screen keeps them so returning to a tab is instant — which is exactly the
 * condition under which a "first one loaded" rule would look correct and be wrong.
 */

const period = (label: string) => ({
  financialYearId: `fy-${label}`,
  financialYearLabel: label,
  from: `${label.slice(0, 4)}-04-01`,
  to: `${Number(label.slice(0, 4)) + 1}-03-31`,
  isOpen: true,
});

/** Nothing read yet. Every field is nullable because the screen fills them as they arrive. */
const empty = (): LoadedReports => ({
  balanceSheet: null,
  profitLoss: null,
  trialBalance: null,
  dayBook: null,
  receiptsPayments: null,
  cashFlow: null,
  receivables: null,
  payables: null,
  forex: null,
  cashBook: null,
  bankBook: null,
  groupSummary: null,
  register: null,
  ledgerReport: null,
  reconciliation: null,
  monthly: null,
  audit: null,
  soa: null,
  fundsFlow: null,
  ratios: null,
  exceptions: null,
});

/** Which report each tab reads its period from. The four with none are stated as such. */
const SOURCE: Record<Tab, keyof LoadedReports | null> = {
  'balance-sheet': 'balanceSheet',
  'profit-loss': 'profitLoss',
  'trial-balance': 'trialBalance',
  'day-book': 'dayBook',
  'receipts-payments': 'receiptsPayments',
  'cash-flow': 'cashFlow',
  'cash-book': 'cashBook',
  'bank-book': 'bankBook',
  'group-summary': 'groupSummary',
  register: 'register',
  ledger: 'ledgerReport',
  'bank-reconciliation': 'reconciliation',
  'monthly-summary': 'monthly',
  'statement-of-account': 'soa',
  'funds-flow': 'fundsFlow',
  ratios: 'ratios',
  exceptions: 'exceptions',
  receivables: null,
  payables: null,
  forex: null,
  audit: null,
};

/** Cash and Bank Book are lists of statements and take theirs from the first. */
const LIST_SOURCES = new Set<keyof LoadedReports>(['cashBook', 'bankBook']);

/*
  A bag holding nothing but the periods named.

  `periodOf` reads one field off each report and nothing else, so a stub carrying only `period` is
  the whole of what it needs — and building the rest of a balance sheet to prove it would only
  obscure what the case is about. The cast is the price of that, and it lives here alone so no
  individual case has to repeat it.
*/
function bagWith(...entries: Array<[keyof LoadedReports, string]>): LoadedReports {
  const bag: Record<string, unknown> = { ...empty() };
  for (const [key, label] of entries) {
    bag[key] = LIST_SOURCES.has(key) ? [{ period: period(label) }] : { period: period(label) };
  }
  return bag as unknown as LoadedReports;
}

const withPeriod = (key: keyof LoadedReports, label: string) => bagWith([key, label]);

describe('periodOf', () => {
  it('covers every tab the screen can open', () => {
    // Guards the switch against a tab added later and quietly left without a period.
    expect(Object.keys(SOURCE).sort()).toEqual([...TAB_IDS].sort());
  });

  for (const tab of TAB_IDS) {
    const key = SOURCE[tab];

    if (key === null) {
      it(`${tab}: answers no period, because it covers no span`, () => {
        // Ageing and forex are as at one date; the audit trail is ordered by when a change was
        // made. A financial year printed above any of them would describe something else.
        expect(periodOf(tab, empty())).toBeUndefined();
      });
      continue;
    }

    it(`${tab}: reads the period off its own report`, () => {
      expect(periodOf(tab, withPeriod(key, '2026-2027'))?.financialYearLabel).toBe('2026-2027');
    });

    it(`${tab}: answers nothing until that report has been read`, () => {
      expect(periodOf(tab, empty())).toBeUndefined();
    });

    it(`${tab}: ignores a period left behind by another report`, () => {
      /*
        The failure this whole function exists to prevent. Open the balance sheet, change the
        dates, switch tabs: the balance sheet is still in state holding the *old* period, and a
        rule that took the first report it found would print those dates over the new figures.
      */
      const other: keyof LoadedReports = key === 'trialBalance' ? 'balanceSheet' : 'trialBalance';
      expect(periodOf(tab, withPeriod(other, '2019-2020'))).toBeUndefined();
    });
  }

  it('prefers the open tab even when several reports are loaded', () => {
    const bag = bagWith(['balanceSheet', '2019-2020'], ['trialBalance', '2026-2027']);

    expect(periodOf('trial-balance', bag)?.financialYearLabel).toBe('2026-2027');
    expect(periodOf('balance-sheet', bag)?.financialYearLabel).toBe('2019-2020');
  });

  it('takes the cash book period from the first statement, and none from an empty list', () => {
    expect(periodOf('cash-book', { ...empty(), cashBook: [] })).toBeUndefined();
  });
});
