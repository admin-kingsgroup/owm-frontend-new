import { describe, it, expect } from 'vitest';

import { previewVoucherNumber } from './preview-number';
import type { NumberingConfig } from '../model/types';

const config = (patch: Partial<NumberingConfig> = {}): NumberingConfig => ({
  prefix: 'SAL',
  suffix: '',
  numberLength: 6,
  prefillWithZero: true,
  numberFormat: 'COMPANY_PREFIXED',
  resetFrequency: 'YEARLY',
  startingNumber: 1,
  ...patch,
});

/**
 * This preview has to agree with the number the server actually issues. It is the one place the
 * frontend reimplements a server rule, so these cases mirror the backend's own numbering suite —
 * if the two ever disagree, the form is quietly lying about what a voucher will be called.
 */
describe('previewVoucherNumber', () => {
  it('builds a company-prefixed number with the period stamped in', () => {
    expect(previewVoucherNumber(config(), 'ABC001', 'SALES', '2026-2027')).toBe(
      'ABC001/SAL/26-27/000001',
    );
  });

  it('drops the company code in Tally style', () => {
    expect(
      previewVoucherNumber(config({ numberFormat: 'TALLY_STYLE' }), 'ABC001', 'SALES', '2026-2027'),
    ).toBe('SAL/26-27/000001');
  });

  it('appends a suffix after the serial', () => {
    expect(previewVoucherNumber(config({ suffix: 'EXP' }), 'ABC001', 'SALES', '2026-2027')).toBe(
      'ABC001/SAL/26-27/000001/EXP',
    );
  });

  it('falls back to the voucher type code when no prefix is set', () => {
    expect(previewVoucherNumber(config({ prefix: '' }), 'ABC001', 'EXPORT', '2026-2027')).toBe(
      'ABC001/EXPORT/26-27/000001',
    );
  });

  it('honours width and zero-prefill', () => {
    expect(previewVoucherNumber(config({ numberLength: 4 }), 'ABC001', 'SALES', '2026-2027')).toBe(
      'ABC001/SAL/26-27/0001',
    );
    expect(
      previewVoucherNumber(config({ prefillWithZero: false }), 'ABC001', 'SALES', '2026-2027'),
    ).toBe('ABC001/SAL/26-27/1');
  });

  it('starts at the configured number', () => {
    expect(
      previewVoucherNumber(config({ startingNumber: 500 }), 'ABC001', 'SALES', '2026-2027'),
    ).toBe('ABC001/SAL/26-27/000500');
  });

  it('prints no period stamp when the counter never resets', () => {
    // A serial that never repeats needs nothing to disambiguate it.
    expect(
      previewVoucherNumber(config({ resetFrequency: 'NEVER' }), 'ABC001', 'SALES', '2026-2027'),
    ).toBe('ABC001/SAL/000001');
  });

  it('shortens the financial year the way a document reads it', () => {
    expect(previewVoucherNumber(config(), 'ABC001', 'SALES', '2030-2031')).toContain('/30-31/');
  });
});
