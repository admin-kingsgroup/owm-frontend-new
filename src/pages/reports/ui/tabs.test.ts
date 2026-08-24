import { describe, it, expect } from 'vitest';

import { TAB_IDS, TAB_LABELS, isTab, showsMoney, usesPeriod, isComparable } from './tabs';

/**
 * What the reports screen may say about a tab before it has read anything.
 *
 * These three predicates decide which controls appear above a statement, and each of them is a
 * claim: that the period boxes apply, that a comparison can be answered, that there is money on
 * the page to hide. A control offered where its claim is false is worse than a missing one — it
 * says the screen can do something it cannot, and the reader learns to distrust the rest.
 */
describe('the reports screen tabs', () => {
  it('labels every tab it can open', () => {
    // A tab added without a label renders an empty heading rather than failing, so this is the
    // only place the omission would be caught.
    expect(Object.keys(TAB_LABELS).sort()).toEqual([...TAB_IDS].sort());
    for (const tab of TAB_IDS) expect(TAB_LABELS[tab].trim()).not.toBe('');
  });

  describe('isTab', () => {
    it('accepts the ids the screen knows', () => {
      for (const tab of TAB_IDS) expect(isTab(tab)).toBe(true);
    });

    it('refuses anything else, including nothing at all', () => {
      // A hand-typed address, or a link from an older build.
      expect(isTab('balance_sheet')).toBe(false);
      expect(isTab('BALANCE-SHEET')).toBe(false);
      expect(isTab('')).toBe(false);
      expect(isTab(null)).toBe(false);
    });
  });

  describe('showsMoney', () => {
    it('is false for the two reports that write no figures', () => {
      // The audit trail lists who changed what; the exception report lists sentences. Offering to
      // reveal nil figures on either is offering a control that cannot act.
      expect(showsMoney('audit')).toBe(false);
      expect(showsMoney('exceptions')).toBe(false);
    });

    it('is true everywhere else', () => {
      for (const tab of TAB_IDS) {
        if (tab === 'audit' || tab === 'exceptions') continue;
        expect(showsMoney(tab)).toBe(true);
      }
    });
  });

  describe('usesPeriod', () => {
    it('is false only for the audit trail', () => {
      // It is ordered by when a change was made, not by the dates of what changed, so the same
      // From/To boxes would mean a different thing on that one tab.
      expect(usesPeriod('audit')).toBe(false);
      for (const tab of TAB_IDS) {
        if (tab === 'audit') continue;
        expect(usesPeriod(tab)).toBe(true);
      }
    });
  });

  describe('isComparable', () => {
    it('names exactly the statements the server answers a comparison for', () => {
      const comparable = TAB_IDS.filter(isComparable);
      expect([...comparable].sort()).toEqual(
        ['balance-sheet', 'cash-flow', 'profit-loss', 'receipts-payments', 'trial-balance'].sort(),
      );
    });

    it('offers no comparison where none can be answered', () => {
      // The flag rides along on every report request and the rest ignore it, so a tick box here
      // would leave the reader wondering whether the two years really did match.
      for (const tab of ['day-book', 'ratios', 'exceptions', 'audit', 'forex'] as const) {
        expect(isComparable(tab)).toBe(false);
      }
    });
  });
});
