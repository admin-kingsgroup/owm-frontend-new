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

const company = (patch: Partial<Company> = {}): Company => ({
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
  currentSeedVersion: 4,
  features: {
    billWiseDetails: true,
    multiCurrency: true,
  },
  ...patch,
});

/** A company holding everything the product has. */
const current = company({ seedVersion: 4 });

/**
 * Syncing default masters is the only way a company created before a release receives what that
 * release added, and it is irreversible in the sense that nothing here undoes it. So what is
 * covered is what a reader would act on: that the panel says what was actually inserted rather
 * than a fixed sentence, and that the new version reaches the shared company record — which is
 * what makes the new voucher types appear in the menus and the button bar without a reload.
 */
/** The one this panel is for: three of four, with rows waiting in the templates. */
const behind = company();

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
      <CompanySettingsPanel company={behind} onChanged={changed} onMastersSynced={synced} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    // Only the kinds that received something, listed as they read aloud.
    expect(
      await screen.findByText(
        'Added 3 account groups, 2 voucher types and 2 number series. Now on version 4.',
      ),
    ).toBeTruthy();
    expect(changed).toHaveBeenCalledWith({ ...behind, seedVersion: 4 });
    // The chart of accounts and the voucher types one tab away must re-read what this created.
    expect(synced).toHaveBeenCalledTimes(1);
  });

  /* The company is behind, so the control is offered — and by the time it is pressed another tab
     has already synced. The server answers zeroes rather than refusing, and the panel says so. */
  it('says so plainly when there was nothing left to add', async () => {
    result = {
      accountGroups: 0,
      ledgers: 0,
      voucherTypes: 0,
      numberSeries: 0,
      seedVersion: 4,
    };
    const changed = vi.fn();
    const synced = vi.fn();
    render(
      <CompanySettingsPanel company={behind} onChanged={changed} onMastersSynced={synced} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(
      await screen.findByText('Nothing to add — this company is already on version 4.'),
    ).toBeTruthy();
    // The version moved, so the record is republished; nothing was inserted, so no list re-reads —
    // reading five master lists back to show the same rows is a cost for nothing.
    await waitFor(() => expect(sync).toHaveBeenCalled());
    expect(changed).toHaveBeenCalledWith({ ...behind, seedVersion: 4 });
    expect(synced).not.toHaveBeenCalled();
  });

  /*
    A control whose only possible answer is "nothing to add" is a question the screen can settle
    itself. Offering it on every company was how the one company that needed it stopped standing
    out — and it made a reader press a button to learn something already known.
  */
  it('offers no sync to a company that already holds everything, and says so', () => {
    render(
      <CompanySettingsPanel company={current} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect(screen.getByText('version 4 · up to date')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
    // The explanation goes with the control it explains.
    expect(screen.queryByText(/Syncing gives this company/)).toBeNull();
  });

  it('says which version a company behind is on, against the one the product is on', () => {
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect(screen.getByText('version 3 of 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy();
  });

  it('reports a refusal rather than leaving the button looking busy', async () => {
    sync.mockRejectedValueOnce(new Error('boom'));
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync' }).hasAttribute('disabled')).toBe(false);
  });
});
