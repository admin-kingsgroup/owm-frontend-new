// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

import type { VoucherType } from '@/entities/voucher-type';

import { useVoucherTypes } from './use-voucher-types';

const type = (code: string): VoucherType => ({
  id: `vt-${code}`,
  companyId: 'c1',
  code,
  name: code,
  category: 'PAYMENT',
  numberingMethod: 'AUTO',
  numbering: {
    prefix: '',
    suffix: '',
    numberLength: 6,
    prefillWithZero: true,
    numberFormat: 'TALLY_STYLE',
    resetFrequency: 'YEARLY',
    startingNumber: 1,
  },
  isSystem: true,
  isActive: true,
  configuration: {},
});

/** What the server answers next. Reassigned per test rather than re-mocked. */
let answer: VoucherType[] = [];
const list = vi.fn(async (_companyId: string) => answer);

vi.mock('@/entities/voucher-type', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/voucher-type')>()),
  listVoucherTypes: (companyId: string) => list(companyId),
}));

/**
 * The list every menu and the whole button bar is drawn from.
 *
 * Two things here would fail silently. A deactivated type reaching the bar offers a document the
 * form then refuses; and the list not re-reading after a masters sync means Income and Expense are
 * created on the server and never appear — the sync looks like it did nothing, which is the exact
 * complaint the sync exists to answer.
 */
describe('useVoucherTypes', () => {
  beforeEach(() => {
    answer = [type('PAYMENT'), { ...type('OLD'), isActive: false }];
    list.mockClear();
  });

  afterEach(cleanup);

  it('answers with the active types, and asks once', async () => {
    const { result } = renderHook(() => useVoucherTypes('c1', 3));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].code).toBe('PAYMENT');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('re-reads when the company’s masters are synced, so the new types appear at once', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: 3 } },
    );

    await waitFor(() => expect(result.current).toHaveLength(1));

    answer = [type('PAYMENT'), type('INCOME'), type('EXPENSE')];
    rerender({ version: 4 });

    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(result.current.map((entry) => entry.code)).toEqual(['PAYMENT', 'INCOME', 'EXPENSE']);
  });

  it('does not re-read when nothing about the company has moved', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: 4 } },
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    rerender({ version: 4 });

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('holds nothing back from the previous company while the next one loads', async () => {
    const { result, rerender } = renderHook(
      ({ companyId }: { companyId: string }) => useVoucherTypes(companyId, 4),
      { initialProps: { companyId: 'c1' } },
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    rerender({ companyId: 'c2' });

    // Tagged with the company it describes — c1's types must not be drawn under c2.
    expect(result.current).toHaveLength(0);
  });
});
