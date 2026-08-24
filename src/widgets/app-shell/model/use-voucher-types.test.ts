// @vitest-environment jsdom
import { StrictMode } from 'react';
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

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    expect(result.current.types[0].code).toBe('PAYMENT');
    expect(list).toHaveBeenCalledTimes(1);
  });

  /*
    The application runs inside StrictMode, which mounts, tears down and mounts again. A read that
    is discarded on teardown never arrives if the second pass decides it has already been asked —
    the bar then falls back to the four types every company has and silently drops the rest, which
    is what a browser check caught and no unit test could.
  */
  it('still answers when the effect is mounted twice, as StrictMode mounts it', async () => {
    const { result } = renderHook(() => useVoucherTypes('c1', 4), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    expect(result.current.types[0].code).toBe('PAYMENT');
  });

  /*
    Holding none and not knowing yet are opposites, and an empty array says both. A company that has
    switched every voucher type off can raise nothing, and the caller has to be able to tell that
    from a list still being read — otherwise the bar offers four documents the form will refuse.
  */
  it('separates holding no types from not knowing yet', async () => {
    answer = [];
    const { result } = renderHook(() => useVoucherTypes('c1', 4));

    // Before the answer: nothing, and not known.
    expect(result.current).toEqual({ types: [], known: false });

    await waitFor(() => expect(result.current.known).toBe(true));
    expect(result.current.types).toHaveLength(0);
  });

  it('re-reads when the company’s masters are synced, so the new types appear at once', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: 3 } },
    );

    await waitFor(() => expect(result.current.types).toHaveLength(1));

    answer = [type('PAYMENT'), type('INCOME'), type('EXPENSE')];
    rerender({ version: 4 });

    await waitFor(() => expect(result.current.types).toHaveLength(3));
    expect(result.current.types.map((entry) => entry.code)).toEqual(['PAYMENT', 'INCOME', 'EXPENSE']);
  });

  /*
    The shell passes the company's seed version, and the company record arrives after the first
    render — so the version goes from unknown to known on every cold load of a company screen.
    Treated as a change, that read the list twice for a number that had not moved.
  */
  it('does not read twice when the version arrives after the company', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version?: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: undefined } as { version?: number } },
    );

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    rerender({ version: 4 });

    expect(list).toHaveBeenCalledTimes(1);

    // And the version is remembered, so the next move is still seen.
    answer = [type('PAYMENT'), type('INCOME')];
    rerender({ version: 5 });
    await waitFor(() => expect(result.current.types).toHaveLength(2));
  });

  /*
    A read that failed is not a read already done. The guard that stops the list being read twice
    on a cold load would otherwise treat it as one, and a transient failure before the company
    record arrived would leave the menus and the bar on the four-type fallback all session.
  */
  it('tries again after a failed read, once the version arrives', async () => {
    list.mockRejectedValueOnce(new Error('offline'));

    const { result, rerender } = renderHook(
      ({ version }: { version?: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: undefined } as { version?: number } },
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(result.current.types).toHaveLength(0);

    rerender({ version: 4 });

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not re-read when nothing about the company has moved', async () => {
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) => useVoucherTypes('c1', version),
      { initialProps: { version: 4 } },
    );

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    rerender({ version: 4 });

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('holds nothing back from the previous company while the next one loads', async () => {
    const { result, rerender } = renderHook(
      ({ companyId }: { companyId: string }) => useVoucherTypes(companyId, 4),
      { initialProps: { companyId: 'c1' } },
    );

    await waitFor(() => expect(result.current.types).toHaveLength(1));
    rerender({ companyId: 'c2' });

    // Tagged with the company it describes — c1's types must not be drawn under c2.
    expect(result.current.types).toHaveLength(0);
  });
});
