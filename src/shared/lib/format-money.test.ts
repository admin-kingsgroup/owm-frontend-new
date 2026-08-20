import { describe, it, expect } from 'vitest';

import { formatMoney, formatMoneyWithSide } from './format-money';

/**
 * Amounts arrive as decimal strings because they are Decimal128 on the server. What matters here
 * is that a malformed or oversized figure degrades to something readable rather than to "NaN" or
 * to a number quietly different from the one in the books.
 */
describe('formatMoney', () => {
  it('always shows two decimal places', () => {
    expect(formatMoney('1000')).toContain('1,000.00');
    expect(formatMoney('1000.5')).toContain('1,000.50');
  });

  it('wraps negatives in brackets, the accounting convention', () => {
    expect(formatMoney('-250')).toBe('(250.00)');
  });

  it('can show a plain minus instead when asked', () => {
    expect(formatMoney('-250', { accounting: false })).toBe('-250.00');
  });

  it('adds a currency symbol when given a code', () => {
    const formatted = formatMoney('1000', { currency: 'INR' });
    expect(formatted).toMatch(/1,000\.00/);
    expect(formatted).not.toBe('1,000.00');
  });

  it('falls back to a bare number for an unrecognised currency instead of throwing', () => {
    // A wrong symbol is a display problem; a thrown error takes the whole screen down.
    expect(() => formatMoney('1000', { currency: 'NOTACODE' })).not.toThrow();
    expect(formatMoney('1000', { currency: 'NOTACODE' })).toContain('1,000.00');
  });

  it('returns a malformed figure as itself rather than as NaN', () => {
    expect(formatMoney('not-a-number')).toBe('not-a-number');
    expect(formatMoney('')).toBe('—');
  });

  it('shows a figure beyond exact precision raw rather than quietly wrong', () => {
    const huge = '999999999999999999';
    expect(formatMoney(huge)).toBe(huge);
  });

  it('formats zero without brackets', () => {
    expect(formatMoney('0')).toBe('0.00');
  });
});

describe('formatMoneyWithSide', () => {
  it('labels a debit-positive figure Dr and a negative one Cr', () => {
    expect(formatMoneyWithSide('600')).toBe('600.00 Dr');
    expect(formatMoneyWithSide('-600')).toBe('600.00 Cr');
  });

  it('shows the magnitude unsigned, since the side already carries the sign', () => {
    expect(formatMoneyWithSide('-600')).not.toContain('(');
  });

  it('leaves zero unlabelled', () => {
    expect(formatMoneyWithSide('0')).toBe('0.00');
  });
});
