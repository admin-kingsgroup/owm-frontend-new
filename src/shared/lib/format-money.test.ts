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

describe('regional grouping', () => {
  it('groups the Indian way for an Indian company, whatever the browser is set to', () => {
    // 51,76,350 and not 5,176,350 — the same digits, read wrongly at a glance by the reader it
    // is meant for. This is the whole reason the country is threaded through.
    expect(formatMoney('5176350', { currency: 'INR', country: 'IN' })).toContain('51,76,350.00');
  });

  it('groups in threes for a company that reads that way', () => {
    expect(formatMoney('5176350', { currency: 'USD', country: 'US' })).toContain('5,176,350.00');
  });

  it('falls back to the reader when no country is known', () => {
    expect(() => formatMoney('5176350', { currency: 'INR' })).not.toThrow();
  });

  it('ignores a country it cannot make sense of rather than throwing', () => {
    expect(() => formatMoney('1000', { currency: 'INR', country: 'not-a-country' })).not.toThrow();
  });

  it('keeps the accounting brackets when grouping regionally', () => {
    expect(formatMoney('-219600', { currency: 'INR', country: 'IN' })).toMatch(
      /^\(.*2,19,600\.00\)$/,
    );
  });
});
