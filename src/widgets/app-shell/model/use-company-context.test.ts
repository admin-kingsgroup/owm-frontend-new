// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

import type { CompanyContext } from '@/entities/report';

import { useCompanyReadoutState } from './use-company-context';

const readout = (drafts: number): CompanyContext =>
  ({
    period: {
      financialYearId: 'fy1',
      financialYearLabel: '2026-2027',
      from: '2026-04-01',
      to: '2027-03-31',
    },
    difference: '0.00',
    draftVouchers: drafts,
  }) as unknown as CompanyContext;

/** What the server answers next. Reassigned per test rather than re-mocked. */
let answer: unknown = readout(0);
let fails = false;
const get = vi.fn(async (_companyId: string) => {
  if (fails) throw new Error('network');
  return answer;
});

vi.mock('@/entities/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/report')>()),
  getCompanyContext: (companyId: string) => get(companyId),
}));

/**
 * What the frame is allowed to believe about the open company.
 *
 * `context` is declared as the readout or null, and the whole shell reads it on that promise — the
 * status strip reaches straight for `draftVouchers`, and it is rendered outside the boundary that
 * would catch a throw. So the value that reaches state has to be one of the two things the type
 * names. These cases are the ways it might not be.
 */
describe('useCompanyReadoutState', () => {
  beforeEach(() => {
    answer = readout(0);
    fails = false;
    get.mockClear();
  });
  afterEach(cleanup);

  it('carries the readout once it arrives', async () => {
    answer = readout(3);
    const { result } = renderHook(() => useCompanyReadoutState('c1'));
    await waitFor(() => expect(result.current.context?.draftVouchers).toBe(3));
  });

  it('answers null until the first read settles', () => {
    const { result } = renderHook(() => useCompanyReadoutState('c1'));
    expect(result.current.context).toBeNull();
  });

  it('stays null after a read that failed outright', async () => {
    fails = true;
    const { result } = renderHook(() => useCompanyReadoutState('c1'));
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current.context).toBeNull();
  });

  /*
    The case that took the whole app down, and the reason the guard exists.

    A 200 is not proof of a body: answer an API path with the app's own HTML — a proxy rule falling
    through to index.html, a gateway rewriting a rejected response — and the request resolves
    carrying nothing. Stored, `context` is neither the readout nor null, `!== null` lets it past,
    and the first field read on it throws where nothing catches it.
  */
  for (const [name, body] of [
    ['nothing at all', undefined],
    ['a null body', null],
    ['a page of HTML', '<!doctype html><html></html>'],
    ['a bare number', 0],
  ] as const) {
    it(`treats ${name} as a miss rather than a readout`, async () => {
      answer = body;
      const { result } = renderHook(() => useCompanyReadoutState('c1'));
      await waitFor(() => expect(get).toHaveBeenCalled());
      expect(result.current.context).toBeNull();
    });
  }

  it('never leaves the previous company’s readout on screen', async () => {
    // Switching books must not show the year or the draft count of the books just closed.
    answer = readout(7);
    const { result, rerender } = renderHook(({ id }) => useCompanyReadoutState(id), {
      initialProps: { id: 'c1' },
    });
    await waitFor(() => expect(result.current.context?.draftVouchers).toBe(7));

    rerender({ id: 'c2' });
    expect(result.current.context).toBeNull();
  });

  it('asks once per company', async () => {
    const { rerender } = renderHook(({ id }) => useCompanyReadoutState(id), {
      initialProps: { id: 'c1' },
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    rerender({ id: 'c1' });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
