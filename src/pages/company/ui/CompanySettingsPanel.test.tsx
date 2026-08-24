// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

import type { Company, PendingMasters, SeedResult } from '@/entities/company';

import { CompanySettingsPanel } from './CompanySettingsPanel';

let result: SeedResult;
const sync = vi.fn(async (_companyId: string) => result);

/** What the server says is waiting. The panel asks before it offers anything. */
let waiting: PendingMasters = { accountGroups: 3, ledgers: 0, voucherTypes: 2, numberSeries: 2, blockedReason: null };
const pending = vi.fn(async (_companyId: string) => waiting);

vi.mock('@/entities/company', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/company')>()),
  syncDefaultMasters: (companyId: string) => sync(companyId),
  getPendingDefaultMasters: (companyId: string) => pending(companyId),
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
  beforeEach(() => {
    waiting = { accountGroups: 3, ledgers: 0, voucherTypes: 2, numberSeries: 2, blockedReason: null };
  });

  afterEach(() => {
    sync.mockClear();
    pending.mockClear();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Sync' }));

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

    fireEvent.click(await screen.findByRole('button', { name: 'Sync' }));

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
    // Nothing to ask about, so nothing is asked.
    expect(pending).not.toHaveBeenCalled();
    // The explanation goes with the control it explains.
    expect(screen.queryByText(/Syncing gives this company/)).toBeNull();
  });

  it('says which version a company behind is on, and names what is waiting', async () => {
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect(screen.getByText('version 3 of 4')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Sync' })).toBeTruthy();
    expect(
      screen.getByText(/Waiting for this company: 3 account groups, 2 voucher types and 2 number series\./),
    ).toBeTruthy();
  });

  /*
    Behind by the number and missing nothing are different things — every row carries the kind of
    company it belongs to as well as the version it arrived in. Offering a control whose whole
    outcome is "nothing to add" is a dead end the screen can rule out before showing it.
  */
  it('offers no sync to a company the new rows do not apply to, and says why', async () => {
    waiting = { accountGroups: 0, ledgers: 0, voucherTypes: 0, numberSeries: 0, blockedReason: null };
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect(
      await screen.findByText(/Nothing in version 4 applies to this kind of books/),
    ).toBeTruthy();
    // Still stated honestly — the stamp is older — but not flagged as something to act on.
    expect(screen.getByText('version 3 of 4')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
  });

  /*
    A company whose last financial year was deleted — reachable, since one holding no vouchers can
    be. Rows are waiting and none of them can land, so a control that could only fail is not shown
    and the server's own reason is. The opposite of "nothing to add", wearing the same zeroes if
    the counts were all the screen looked at.
  */
  it('says why a sync cannot run at all, and offers no control that would fail', async () => {
    waiting = {
      accountGroups: 3,
      ledgers: 0,
      voucherTypes: 2,
      numberSeries: 0,
      blockedReason: 'Company has no financial year to attach number series to',
    };
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Company has no financial year to attach number series to. Masters cannot be synced until it has one.',
    );
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
    // And never explained as nothing being due, which is the other reason a control is absent.
    expect(screen.queryByText(/applies to this kind of books/)).toBeNull();
  });

  /* A read that failed leaves the version as the only thing to go on, which is where this screen
     was before it asked: offer the control rather than hide one that might be needed. */
  it('still offers the sync when it cannot find out what is waiting', async () => {
    pending.mockRejectedValueOnce(new Error('offline'));
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    expect(await screen.findByRole('button', { name: 'Sync' })).toBeTruthy();
    expect(screen.queryByText(/Waiting for this company/)).toBeNull();
  });

  /*
    Only ever true across a deploy — a page held open, or a bundle reaching a browser before the
    API answers from the new release. Short-lived, and the wrong thing to say confidently: a screen
    that announces "up to date" against a number it never received is stating something it does
    not know, which is exactly what the rest of this product refuses to do with a figure.
  */
  it('claims nothing when the server did not say what the product is on', () => {
    const unknown = { ...company(), currentSeedVersion: undefined as unknown as number };
    render(
      <CompanySettingsPanel company={unknown} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    // The number it holds, and no verdict on it either way.
    expect(screen.getByText('version 3')).toBeTruthy();
    expect(screen.queryByText(/up to date/)).toBeNull();
    expect(screen.queryByText(/version 3 of/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
  });

  it('reports a refusal rather than leaving the button looking busy', async () => {
    sync.mockRejectedValueOnce(new Error('boom'));
    render(
      <CompanySettingsPanel company={behind} onChanged={() => {}} onMastersSynced={() => {}} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Sync' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync' }).hasAttribute('disabled')).toBe(false);
  });
});
