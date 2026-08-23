// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import type { Company, SeedResult } from '@/entities/company';

import { CompanySettingsPanel } from './CompanySettingsPanel';

let result: SeedResult;
const sync = vi.fn(async (_companyId: string) => result);

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/company')>()),
  syncDefaultMasters: (companyId: string) => sync(companyId),
}));

const company: Company = {
  id: 'c1',
  name: 'ADB - INR',
  code: 'ARS-01',
  type: 'PERSONAL',
  financialYearStart: '2026-01-01T00:00:00.000Z',
  financialYearEnd: '2026-12-31T00:00:00.000Z',
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE',
  initialized: true,
  // A book created before Income and Expense existed — the case the control is here for.
  seedVersion: 3,
  features: {
    billWiseDetails: true,
    multiCurrency: true,
  },
};

/**
 * Syncing default masters is the only way a company created before a release receives what that
 * release added, and it is irreversible in the sense that nothing here undoes it. So what is
 * covered is what a reader would act on: that the panel says what was actually inserted rather
 * than a fixed sentence, and that the new version reaches the shared company record — which is
 * what makes the new voucher types appear in the menus and the button bar without a reload.
 */
describe('CompanySettingsPanel', () => {
  afterEach(() => {
    sync.mockClear();
    cleanup();
  });

  it('reports exactly what the sync inserted, and publishes the new version', async () => {
    result = {
      accountGroups: 3,
      ledgers: 0,
      voucherTypes: 2,
      numberSeries: 2,
      seedVersion: 4,
    };
    const changed = vi.fn();
    const synced = vi.fn();
    render(
      <CompanySettingsPanel company={company} onChanged={changed} onMastersSynced={synced} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    // Only the kinds that received something, listed as they read aloud.
    expect(
      await screen.findByText(
        'Added 3 account groups, 2 voucher types and 2 number series. Now on version 4.',
      ),
    ).toBeTruthy();
    expect(changed).toHaveBeenCalledWith({ ...company, seedVersion: 4 });
    // The chart of accounts and the voucher types one tab away must re-read what this created.
    expect(synced).toHaveBeenCalledTimes(1);
  });

  it('says so plainly when there was nothing to add', async () => {
    result = {
      accountGroups: 0,
      ledgers: 0,
      voucherTypes: 0,
      numberSeries: 0,
      seedVersion: 3,
    };
    const changed = vi.fn();
    const synced = vi.fn();
    render(
      <CompanySettingsPanel company={company} onChanged={changed} onMastersSynced={synced} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(
      await screen.findByText('Nothing to add — this company is already on version 3.'),
    ).toBeTruthy();
    // Nothing moved, so nothing is republished — a needless write would re-sort the switcher, and
    // re-reading five master lists to show the same rows back is a cost for nothing.
    await waitFor(() => expect(sync).toHaveBeenCalled());
    expect(changed).not.toHaveBeenCalled();
    expect(synced).not.toHaveBeenCalled();
  });

  it('reports a refusal rather than leaving the button looking busy', async () => {
    sync.mockRejectedValueOnce(new Error('boom'));
    render(
      <CompanySettingsPanel company={company} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync' }).hasAttribute('disabled')).toBe(false);
  });
});
