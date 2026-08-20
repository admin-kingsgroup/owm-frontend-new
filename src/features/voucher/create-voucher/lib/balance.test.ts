import { describe, it, expect } from 'vitest';

import { computeBalance } from './balance';
import type { BalanceInput } from './balance';

const line = (patch: Partial<BalanceInput>): BalanceInput => ({
  debit: '',
  credit: '',
  currencyCode: '',
  exchangeRate: '',
  ...patch,
});

describe('computeBalance', () => {
  it('balances a plain base-currency voucher', () => {
    const result = computeBalance([line({ debit: '100' }), line({ credit: '100' })]);

    expect(result).toMatchObject({ totalDebit: 100, totalCredit: 100, isBalanced: true });
  });

  it('reports a difference when the sides disagree', () => {
    const result = computeBalance([line({ debit: '100' }), line({ credit: '60' })]);

    expect(result.isBalanced).toBe(false);
    expect(result.totalDebit - result.totalCredit).toBe(40);
  });

  it('is not balanced when nothing has been entered', () => {
    expect(computeBalance([line({}), line({})]).isBalanced).toBe(false);
  });

  it('converts a foreign line before weighing it', () => {
    // $1,000 at 82 against a 82,000 rupee line balances, even though the typed figures do not.
    const result = computeBalance([
      line({ debit: '1000', currencyCode: 'USD', exchangeRate: '82' }),
      line({ credit: '82000' }),
    ]);

    expect(result.totalDebit).toBe(82000);
    expect(result.isBalanced).toBe(true);
  });

  it('says it is waiting on a rate rather than reporting a difference', () => {
    const result = computeBalance([
      line({ debit: '1000', currencyCode: 'USD' }),
      line({ credit: '82000' }),
    ]);

    // Reporting an 82,000 difference here would send the user to check their amounts.
    expect(result.awaitingRate).toBe(true);
    expect(result.isBalanced).toBe(false);
  });

  it('treats a rate of zero as no rate at all', () => {
    const result = computeBalance([
      line({ debit: '1000', currencyCode: 'USD', exchangeRate: '0' }),
      line({ credit: '82000' }),
    ]);

    expect(result.awaitingRate).toBe(true);
  });

  it('tolerates the fraction a conversion leaves behind', () => {
    // 3 x 82.333 is 246.999, which is the same voucher as 247 and must not read as unbalanced.
    const result = computeBalance([
      line({ debit: '3', currencyCode: 'USD', exchangeRate: '82.333' }),
      line({ credit: '247' }),
    ]);

    expect(result.isBalanced).toBe(true);
  });

  it('ignores a non-numeric amount instead of producing NaN', () => {
    const result = computeBalance([line({ debit: 'abc' }), line({ credit: '100' })]);

    expect(Number.isNaN(result.totalDebit)).toBe(false);
    expect(result.totalDebit).toBe(0);
  });

  it('weighs several foreign lines at their own rates', () => {
    const result = computeBalance([
      line({ debit: '100', currencyCode: 'USD', exchangeRate: '80' }),
      line({ debit: '100', currencyCode: 'EUR', exchangeRate: '90' }),
      line({ credit: '17000' }),
    ]);

    expect(result.totalDebit).toBe(17000);
    expect(result.isBalanced).toBe(true);
  });
});
