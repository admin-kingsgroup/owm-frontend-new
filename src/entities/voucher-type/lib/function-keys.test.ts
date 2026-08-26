import { describe, it, expect } from 'vitest';

import {
  PORTFOLIO_BUSINESS_CODES,
  VOUCHER_FUNCTION_KEYS,
  functionKeyFor,
  inFunctionKeyOrder,
  raisableVoucherTypes,
} from './function-keys';

/**
 * Tally's keys, and the order they are read in.
 *
 * This table is consumed in three places — the shell binds it, the menus print it beside each
 * document, and it decides the order they are listed in. That is why it lives with the entity
 * rather than in any one of them: two copies is how the menu and the button bar would eventually
 * disagree about what F7 does, and a key that opens the wrong document is worse than no key.
 */
describe('the voucher function keys', () => {
  it('binds each seeded document to the key Tally binds it to', () => {
    expect(functionKeyFor('CONTRA')).toBe('F4');
    expect(functionKeyFor('PAYMENT')).toBe('F5');
    expect(functionKeyFor('RECEIPT')).toBe('F6');
    expect(functionKeyFor('JOURNAL')).toBe('F7');
    expect(functionKeyFor('SALES')).toBe('F8');
    expect(functionKeyFor('PURCHASE')).toBe('F9');
    expect(functionKeyFor('CREDIT_NOTE')).toBe('Ctrl+F8');
    expect(functionKeyFor('DEBIT_NOTE')).toBe('Ctrl+F9');
  });

  it('gives a type the company invented no key at all', () => {
    // Inventing one would eventually collide with a real binding, and a key that does the wrong
    // thing is worse than none. Such a type stays reachable from the menu.
    expect(functionKeyFor('EXPORT_SALES')).toBeUndefined();
    expect(functionKeyFor('')).toBeUndefined();
  });

  it('puts the household pair on the same two keys as the trading pair', () => {
    // F8 raises what was earned and F9 what it cost, in either kind of book. A company is one or
    // the other, so only one of each pair is ever present to be bound.
    expect(functionKeyFor('INCOME')).toBe('F8');
    expect(functionKeyFor('EXPENSE')).toBe('F9');
  });

  it('never binds one key to two documents a single company could hold', () => {
    const trading = new Set(['SALES', 'PURCHASE', 'CONTRA', 'PAYMENT', 'RECEIPT', 'JOURNAL']);
    const seen = new Map<string, string>();
    for (const { key, code } of VOUCHER_FUNCTION_KEYS) {
      if (!trading.has(code)) continue;
      expect(seen.has(key)).toBe(false);
      seen.set(key, code);
    }
  });

  describe('inFunctionKeyOrder', () => {
    const type = (code: string, name: string) => ({ code, name });

    it('reads down the keys, not down the alphabet', () => {
      // The server answers alphabetically, which puts Credit Note second in a list somebody is
      // scanning as F4, F5, F6.
      const sorted = inFunctionKeyOrder([
        type('CREDIT_NOTE', 'Credit Note'),
        type('SALES', 'Sales'),
        type('CONTRA', 'Contra'),
        type('PAYMENT', 'Payment'),
      ]).map((t) => t.code);

      expect(sorted).toEqual(['CONTRA', 'PAYMENT', 'SALES', 'CREDIT_NOTE']);
    });

    it('puts the types with no key after the ones that have them, alphabetically', () => {
      const sorted = inFunctionKeyOrder([
        type('PROFORMA', 'Proforma'),
        type('SALES', 'Sales'),
        type('DELIVERY', 'Delivery Note'),
        type('CONTRA', 'Contra'),
      ]).map((t) => t.name);

      expect(sorted).toEqual(['Contra', 'Sales', 'Delivery Note', 'Proforma']);
    });

    it('leaves the array it was given alone', () => {
      const given = [type('SALES', 'Sales'), type('CONTRA', 'Contra')];
      const before = given.map((t) => t.code);
      inFunctionKeyOrder(given);
      expect(given.map((t) => t.code)).toEqual(before);
    });

    it('handles a company with nothing to list', () => {
      expect(inFunctionKeyOrder([])).toEqual([]);
    });
  });
  describe('raisableVoucherTypes', () => {
    const type = (code: string, name: string) => ({ code, name });

    it('offers the company its own documents, named as the company names them', () => {
      // A renamed type has to read the same in the strip, the menu and the register.
      const raisable = raisableVoucherTypes(
        [type('PAYMENT', 'Payment Voucher'), type('CONTRA', 'Contra')],
        true,
      );

      expect(raisable).toEqual([
        { code: 'CONTRA', name: 'Contra', key: 'F4' },
        { code: 'PAYMENT', name: 'Payment Voucher', key: 'F5' },
      ]);
    });

    it('gives a type the company invented a place with no key', () => {
      const raisable = raisableVoucherTypes(
        [type('PETTY_CASH', 'Petty Cash'), type('RECEIPT', 'Receipt')],
        true,
      );

      expect(raisable).toEqual([
        { code: 'RECEIPT', name: 'Receipt', key: 'F6' },
        { code: 'PETTY_CASH', name: 'Petty Cash' },
      ]);
    });

    it('lets only the first claimant of a shared key keep it', () => {
      // A company that invented a second document under SALES would otherwise print F8 twice while
      // only one of them answered the key.
      const raisable = raisableVoucherTypes(
        [type('SALES', 'Sales'), type('INCOME', 'Income')],
        true,
      );

      expect(raisable).toEqual([
        { code: 'SALES', name: 'Sales', key: 'F8' },
        { code: 'INCOME', name: 'Income' },
      ]);
    });

    it('stands in the four every posting company has while the list is not known', () => {
      // Still being read, or read and failed. No way in at all is the worse answer.
      expect(raisableVoucherTypes([], false)).toEqual([
        { code: 'CONTRA', name: 'Contra', key: 'F4' },
        { code: 'PAYMENT', name: 'Payment', key: 'F5' },
        { code: 'RECEIPT', name: 'Receipt', key: 'F6' },
        { code: 'JOURNAL', name: 'Journal', key: 'F7' },
      ]);
    });

    it('offers nothing to a company that has switched every type off', () => {
      // Known and empty is a decision, not a gap: offering four the form would refuse is worse.
      expect(raisableVoucherTypes([], true)).toEqual([]);
    });

    it('gives a portfolio workspace its own four, on the Ctrl row', () => {
      /*
        A company either keeps its own books or measures other people's, so these can never be
        seeded alongside Contra, Payment, Receipt and Journal — the same guarantee that lets Income
        and Expense share F8 and F9 with Sales and Purchase.
      */
      const raisable = raisableVoucherTypes(
        [
          type('ADJUSTMENT', 'Adjustment'),
          type('BUSINESS_PROFIT', 'Business Profit'),
          type('CAPITAL_INTRODUCTION', 'Capital Introduction'),
          type('PROFIT_ALLOCATION', 'Profit Allocation'),
        ],
        true,
      );

      // Alphabetical in, worked order out: money in, profit earned, profit allocated, fixes last.
      expect(raisable).toEqual([
        { code: 'CAPITAL_INTRODUCTION', name: 'Capital Introduction', key: 'Ctrl+F6' },
        { code: 'BUSINESS_PROFIT', name: 'Business Profit', key: 'Ctrl+F7' },
        { code: 'PROFIT_ALLOCATION', name: 'Profit Allocation', key: 'Ctrl+F8' },
        { code: 'ADJUSTMENT', name: 'Adjustment', key: 'Ctrl+F9' },
      ]);
    });

    it("stands in a portfolio's own four, never the books' four, while its list is unknown", () => {
      // Offering a workspace Contra and Payment would name documents it certainly does not hold.
      expect(raisableVoucherTypes([], false, PORTFOLIO_BUSINESS_CODES)).toEqual([
        { code: 'CAPITAL_INTRODUCTION', name: 'Capital Introduction', key: 'Ctrl+F6' },
        { code: 'BUSINESS_PROFIT', name: 'Business Profit', key: 'Ctrl+F7' },
        { code: 'PROFIT_ALLOCATION', name: 'Profit Allocation', key: 'Ctrl+F8' },
        { code: 'ADJUSTMENT', name: 'Adjustment', key: 'Ctrl+F9' },
      ]);
    });

    it('leaves the array it was given alone', () => {
      const given = [type('SALES', 'Sales'), type('CONTRA', 'Contra')];
      raisableVoucherTypes(given, true);
      expect(given.map((t) => t.code)).toEqual(['SALES', 'CONTRA']);
    });
  });
});
