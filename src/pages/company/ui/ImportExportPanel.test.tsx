// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

import type { AccountGroup } from '@/entities/account-group';
import type { Currency } from '@/entities/currency';
import type { Ledger } from '@/entities/ledger';

import { ImportExportPanel } from './ImportExportPanel';

const createLedger = vi.fn();
const updateLedger = vi.fn();
const createAccountGroup = vi.fn();
const updateAccountGroup = vi.fn();

vi.mock('@/entities/ledger', () => ({
  createLedger: (...args: unknown[]) => createLedger(...args),
  updateLedger: (...args: unknown[]) => updateLedger(...args),
  // The panel re-reads the chart when an import starts rather than trusting its props.
  listLedgers: () => Promise.resolve(ledgers),
}));

vi.mock('@/entities/account-group', () => ({
  createAccountGroup: (...args: unknown[]) => createAccountGroup(...args),
  updateAccountGroup: (...args: unknown[]) => updateAccountGroup(...args),
  listAccountGroups: () => Promise.resolve(groups),
}));

const groups = [
  {
    id: 'g1',
    companyId: 'c1',
    parentId: null,
    code: 'CURRENT_ASSETS',
    name: 'Current Assets',
    nature: 'ASSET',
    groupType: 'BALANCE_SHEET',
    isSystem: true,
    isActive: true,
  },
] as AccountGroup[];

const ledgers = [
  {
    id: 'l1',
    companyId: 'c1',
    accountGroupId: 'g1',
    code: 'HDFC_BANK',
    name: 'HDFC Bank — 4021',
    ledgerType: 'BANK',
    openingBalance: '0.00',
    openingBalanceType: 'DEBIT',
    maintainBillwise: false,
    isSystem: false,
    isActive: true,
  },
] as Ledger[];

const currencies = [
  { id: 'cur-usd', companyId: 'c1', code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2, isActive: true },
] as Currency[];

/**
 * A chosen file, the way the component receives one.
 *
 * jsdom gives `File` no working `text()`, and the component reads the file rather than the input,
 * so the method is supplied here. The change event carries the file the same way the browser does,
 * which is the path the component actually runs down.
 */
function csv(name: string, content: string): File {
  const file = new File([content], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

function panel(onImported = vi.fn()) {
  return render(
    <ImportExportPanel
      companyId="c1"
      companyCode="ADB"
      groups={groups}
      ledgers={ledgers}
      currencies={currencies}
      onImported={onImported}
    />,
  );
}

/** Hands the input a file, the way a browser does when one is chosen. */
function upload(input: HTMLInputElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

const ledgerInput = () =>
  screen
    .getByText(/Ledgers CSV/)
    .closest('label')!
    .querySelector('input')!;
const groupInput = () =>
  screen
    .getByText(/Account groups CSV/)
    .closest('label')!
    .querySelector('input')!;

beforeEach(() => {
  createLedger.mockResolvedValue({ id: 'new' });
  updateLedger.mockResolvedValue({ id: 'l1' });
  createAccountGroup.mockImplementation((_c: string, input: { code: string }) =>
    Promise.resolve({ id: `id-${input.code}` }),
  );
  updateAccountGroup.mockResolvedValue({ id: 'g1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('importing a chart of accounts', () => {
  it('updates a code that already exists rather than refusing it', async () => {
    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode\nHDFC_BANK,HDFC Bank — renamed,CURRENT_ASSETS\n',
      ),
    );

    await waitFor(() => expect(updateLedger).toHaveBeenCalledTimes(1));
    expect(createLedger).not.toHaveBeenCalled();
    expect(updateLedger).toHaveBeenCalledWith(
      'c1',
      'l1',
      expect.objectContaining({ name: 'HDFC Bank — renamed' }),
    );
    expect(await screen.findByText(/1 updated/)).toBeTruthy();
  });

  it('creates a code that is new', async () => {
    panel();

    upload(
      ledgerInput(),
      csv('ledgers.csv', 'code,name,accountGroupCode\nPETTY_CASH,Petty Cash,CURRENT_ASSETS\n'),
    );

    await waitFor(() => expect(createLedger).toHaveBeenCalledTimes(1));
    expect(updateLedger).not.toHaveBeenCalled();
    expect(await screen.findByText(/1 created/)).toBeTruthy();
  });

  /*
    The reason an absent column and an empty one are held apart all the way through. A file with
    three columns is a request to correct three things, not a request to blank everything else.
  */
  it('leaves a field alone when the file has no column for it', async () => {
    panel();

    upload(
      ledgerInput(),
      csv('ledgers.csv', 'code,name,accountGroupCode\nHDFC_BANK,Renamed,CURRENT_ASSETS\n'),
    );

    await waitFor(() => expect(updateLedger).toHaveBeenCalledTimes(1));
    const [, , fields] = updateLedger.mock.calls[0] as [string, string, Record<string, unknown>];

    expect(Object.keys(fields).sort()).toEqual(['accountGroupCode', 'name']);
    expect('maintainBillwise' in fields).toBe(false);
    expect('gstin' in fields).toBe(false);
  });

  /*
    The other half of that distinction, and the half that was wrong. A column that is present and
    empty asks for the field to be cleared — and it must not be sent as `''`, which the server
    reads as a GSTIN that fails its pattern rather than as no GSTIN at all.

    This is the round trip these books actually make: a personal ledger carries no GSTIN, no PAN
    and usually no email on any account, so exporting the chart and reading it straight back in
    put an empty cell under all three on every row.
  */
  it('clears a field the file carries as empty, rather than sending an empty string', async () => {
    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode,gstin,pan,contactEmail\nHDFC_BANK,HDFC Bank — 4021,CURRENT_ASSETS,,,\n',
      ),
    );

    await waitFor(() => expect(updateLedger).toHaveBeenCalledTimes(1));
    const [, , fields] = updateLedger.mock.calls[0] as [string, string, Record<string, unknown>];

    expect(fields.gstin).toBeNull();
    expect(fields.pan).toBeNull();
    expect(fields.contactEmail).toBeNull();
  });

  /* A new record has nothing to clear, and the create DTO refuses a null outright. */
  it('omits an empty field when creating, rather than sending null', async () => {
    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode,gstin,creditDays\nPETTY_CASH,Petty Cash,CURRENT_ASSETS,,\n',
      ),
    );

    await waitFor(() => expect(createLedger).toHaveBeenCalledTimes(1));
    const [, fields] = createLedger.mock.calls[0] as [string, Record<string, unknown>];

    expect('gstin' in fields).toBe(false);
    expect('creditDays' in fields).toBe(false);
    expect(fields.code).toBe('PETTY_CASH');
  });

  /*
    Currency is the one of the three added columns that cannot be set any other way in bulk, and
    every voucher line posted against the account inherits it.
  */
  it('carries currency and credit terms in, upper-casing the currency code', async () => {
    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode,currencyCode,creditLimit,creditDays\nHDFC_BANK,HDFC Bank — 4021,CURRENT_ASSETS,usd,50000,45\n',
      ),
    );

    await waitFor(() => expect(updateLedger).toHaveBeenCalledTimes(1));
    const [, , fields] = updateLedger.mock.calls[0] as [string, string, Record<string, unknown>];

    expect(fields.currencyCode).toBe('USD');
    expect(fields.creditLimit).toBe(50000);
    expect(fields.creditDays).toBe(45);
  });

  /*
    Left to `Number()` this would be NaN, JSON would write it as null, and the server would read
    that as a request to clear the limit — a typo quietly wiping a figure. It fails the row instead.
  */
  it('fails the row when a number column holds something that is not one', async () => {
    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode,creditLimit\nHDFC_BANK,HDFC Bank — 4021,CURRENT_ASSETS,fifty thousand\n',
      ),
    );

    expect(await screen.findByText(/creditLimit is not a number/)).toBeTruthy();
    expect(updateLedger).not.toHaveBeenCalled();
  });

  it('keeps the accepted rows when one is refused, and says which failed', async () => {
    createLedger
      .mockRejectedValueOnce(new Error('That group does not exist'))
      .mockResolvedValueOnce({ id: 'ok' });

    panel();

    upload(
      ledgerInput(),
      csv(
        'ledgers.csv',
        'code,name,accountGroupCode\nBAD,Bad Row,NOPE\nGOOD,Good Row,CURRENT_ASSETS\n',
      ),
    );

    await waitFor(() => expect(createLedger).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/1 created/)).toBeTruthy();
    expect(screen.getByText('That group does not exist')).toBeTruthy();
    // Line 2 is the first row under the header, which is what a spreadsheet shows.
    expect(screen.getByText('BAD')).toBeTruthy();
  });

  /*
    A file written by a person tends to read top-down: the parent first. A file written by a machine
    need not, and a chart exported from another product frequently does not.
  */
  it('creates a group whose parent is further down the same file', async () => {
    panel();

    upload(
      groupInput(),
      csv(
        'groups.csv',
        [
          'code,name,parentCode,nature,groupType',
          'CHILD,Child,PARENT,ASSET,BALANCE_SHEET',
          'PARENT,Parent,,ASSET,BALANCE_SHEET',
          '',
        ].join('\n'),
      ),
    );

    await waitFor(() => expect(createAccountGroup).toHaveBeenCalledTimes(2));
    const order = createAccountGroup.mock.calls.map((call) => (call[1] as { code: string }).code);
    expect(order).toEqual(['PARENT', 'CHILD']);
    expect(await screen.findByText(/2 created/)).toBeTruthy();
  });

  it('says so when a parent is nowhere to be found', async () => {
    panel();

    upload(
      groupInput(),
      csv(
        'groups.csv',
        'code,name,parentCode,nature,groupType\nORPHAN,Orphan,MISSING,ASSET,BALANCE_SHEET\n',
      ),
    );

    expect(await screen.findByText(/parent is not in this file/)).toBeTruthy();
    expect(createAccountGroup).not.toHaveBeenCalled();
  });

  it('refuses a file whose header is not the one it needs', async () => {
    panel();

    upload(ledgerInput(), csv('ledgers.csv', 'a,b,c\n1,2,3\n'));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(createLedger).not.toHaveBeenCalled();
    expect(updateLedger).not.toHaveBeenCalled();
  });

  it('re-reads the chart only when something actually changed', async () => {
    const onImported = vi.fn();
    createLedger.mockRejectedValue(new Error('Refused'));

    panel(onImported);

    upload(ledgerInput(), csv('ledgers.csv', 'code,name,accountGroupCode\nNEW,New,NOPE\n'));

    await waitFor(() => expect(createLedger).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Nothing was changed/)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });
});
