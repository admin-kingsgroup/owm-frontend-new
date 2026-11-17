// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

import type { OcrProviders } from '@/entities/ocr';

import type { BankStatementMatch, ConfirmedMatch, ReconcileOutcome } from '../../model/types';

import { StatementUpload } from './StatementUpload';

const MB = 1024 * 1024;

let providers: OcrProviders;
const fit = vi.fn(async (file: File, _limit: number) => file);
const match = vi.fn(
  async (_companyId: string, _ledgerId: string, _file: File, _provider?: string) => statement,
);

vi.mock('@/entities/ocr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/ocr')>()),
  getOcrProviders: () => Promise.resolve(providers),
  fitImageForOcr: (file: File, limit: number) => fit(file, limit),
}));

vi.mock('../../api/bank-statement-api', () => ({
  matchBankStatement: (companyId: string, ledgerId: string, file: File, provider?: string) =>
    match(companyId, ledgerId, file, provider),
}));

const configured = (): OcrProviders => ({
  enabled: true,
  default_provider: 'grok',
  max_file_size_bytes: 5 * MB,
  providers: [
    {
      id: 'ocr_space',
      label: 'OCR.space',
      configured: true,
      accepted_types: ['image/jpeg', 'image/png', 'application/pdf'],
      max_file_size_bytes: 1 * MB,
      reports_confidence: false,
      model: 'OCR engine 2',
      notes: [],
    },
    {
      id: 'grok',
      label: 'Grok (xAI)',
      configured: true,
      accepted_types: ['image/jpeg', 'image/png'],
      max_file_size_bytes: 5 * MB,
      reports_confidence: false,
      model: 'grok-4.7',
      notes: [],
    },
  ],
});

const statement: BankStatementMatch = {
  ledger: { id: 'l1', code: 'SBI', name: 'SBI Current' },
  provider: 'grok',
  statement: {
    bankName: 'STATE BANK OF EXAMPLE',
    accountNumber: 'XXXX4321',
    periodFrom: null,
    periodTo: null,
    openingBalance: '50000.00',
    closingBalance: null,
  },
  lines: [
    {
      index: 1,
      date: '03/11/2026',
      bankDate: '2026-11-03',
      description: 'NEFT-ACME PHARMA',
      reference: null,
      amount: '25000.00',
      direction: 'deposit',
      balance: '75000.00',
      note: null,
      match: {
        entryId: 'e1',
        voucherId: 'v1',
        voucherNumber: 'RCT/0001',
        voucherDate: '2026-11-02',
        voucherTypeCode: 'RECEIPT',
        amount: '25000.00',
        direction: 'deposit',
        strength: 'strong',
        reasons: ['same amount', 'money in on both', '1 day after the voucher'],
      },
    },
    {
      index: 2,
      date: '20/11/2026',
      bankDate: '2026-11-20',
      description: 'CHQ CLEARING',
      reference: null,
      amount: '900.00',
      direction: null,
      balance: null,
      note: null,
      match: {
        entryId: 'e2',
        voucherId: 'v2',
        voucherNumber: 'PMT/0007',
        voucherDate: '2026-11-08',
        voucherTypeCode: 'PAYMENT',
        amount: '900.00',
        direction: 'withdrawal',
        strength: 'possible',
        reasons: [
          'same amount',
          'direction not readable on the statement',
          '12 days after the voucher',
        ],
      },
    },
    {
      index: 3,
      date: '15/11/2026',
      bankDate: '2026-11-15',
      description: 'SMS CHARGES',
      reference: null,
      amount: '17.70',
      direction: 'withdrawal',
      balance: null,
      match: null,
      note: 'Nothing open in the books for this amount around this date — a bank charge, interest, or an entry not made yet.',
    },
  ],
  summary: { lines: 3, matched: 2, strong: 1, possible: 1, unmatched: 1, openBookLines: 4 },
  warnings: ['Dates were read day-first (DD/MM/YYYY); nothing on the statement said otherwise.'],
  meta: {
    model: 'grok-4.7',
    structuredBy: 'provider_model',
    pageCount: 1,
    fileSizeBytes: 1,
    durationMs: 1,
  },
};

const reconcile = vi.fn(async (matches: ConfirmedMatch[]): Promise<ReconcileOutcome> => ({
  reconciled: matches.map((each) => each.entryId),
  failed: [],
}));

function renderUpload() {
  return render(
    <StatementUpload
      companyId="c1"
      ledgerId="l1"
      money={(value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
      day={(value) => value.split('-').reverse().join('/')}
      typeName={(code) => (code === 'RECEIPT' ? 'Receipt' : 'Payment')}
      onReconcile={reconcile}
    />,
  );
}

function choose(name: string, type: string) {
  const file = new File(['x'], name, { type });
  fireEvent.change(screen.getByLabelText('Bank statement file'), { target: { files: [file] } });
  return file;
}

/**
 * Reading a statement suggests; a person confirms. So what is tested is what reaches the books:
 * only ticked matches, on the bank's own dates, and only after the button is pressed.
 */
describe('StatementUpload', () => {
  beforeEach(() => {
    providers = configured();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('explains why there is no upload while the server has OCR turned off', async () => {
    providers = { ...configured(), enabled: false };
    renderUpload();

    expect(await screen.findByText(/Statement upload is turned off on this server/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Upload statement/ })).toBeNull();
  });

  it('says where the statement is sent before anything is uploaded', async () => {
    renderUpload();
    expect(
      await screen.findByText(/The statement is sent to Grok \(xAI\) to be read/),
    ).toBeTruthy();
  });

  it('suggests matches with the sure ones ticked, and reconciles only what is ticked', async () => {
    renderUpload();
    await screen.findByRole('button', { name: /Upload statement/ });

    const file = choose('statement.jpg', 'image/jpeg');

    await screen.findByText('Suggested matches');
    expect(match).toHaveBeenCalledWith('c1', 'l1', file, 'grok');
    expect(
      screen.getByText(/3 lines read · 2 matched \(1 sure, 1 to check\) · 1 not in the books/),
    ).toBeTruthy();

    const sure = screen.getByLabelText('Reconcile RCT/0001 on 2026-11-03') as HTMLInputElement;
    const check = screen.getByLabelText('Reconcile PMT/0007 on 2026-11-20') as HTMLInputElement;
    expect(sure.checked).toBe(true);
    expect(check.checked).toBe(false);

    // Amounts in the company's money, Indian grouping, in the right column.
    expect(screen.getAllByText('₹25,000.00').length).toBeGreaterThan(0);

    // The bank's own charge is listed apart, with the reason.
    const unmatched = screen.getByText('On the statement, not open in the books')
      .nextElementSibling as HTMLElement;
    expect(within(unmatched).getByText('SMS CHARGES')).toBeTruthy();
    expect(within(unmatched).getByText(/a bank charge, interest/)).toBeTruthy();

    expect(reconcile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile 1 selected' }));

    await screen.findByText('Reconciled 1 line on the dates the bank showed them.');
    expect(reconcile).toHaveBeenCalledWith([
      { voucherId: 'v1', entryId: 'e1', bankDate: '2026-11-03' },
    ]);
    // The reconciled line leaves the suggestions; the unchecked one stays for a decision.
    expect(screen.queryByLabelText('Reconcile RCT/0001 on 2026-11-03')).toBeNull();
    expect(screen.getByLabelText('Reconcile PMT/0007 on 2026-11-20')).toBeTruthy();
  });

  it('sends a PDF to the provider that reads PDFs, and says so', async () => {
    renderUpload();
    await screen.findByRole('button', { name: /Upload statement/ });

    choose('statement.pdf', 'application/pdf');

    await screen.findByText('PDFs are read with OCR.space.');
    expect(match.mock.calls[0][3]).toBe('ocr_space');
    expect(fit).toHaveBeenCalledWith(expect.any(File), 1 * MB);
  });

  it('shows why a photo could not be prepared, and sends nothing', async () => {
    fit.mockRejectedValueOnce(new Error('This photo could not be made smaller than 1 MB.'));
    renderUpload();
    await screen.findByRole('button', { name: /Upload statement/ });

    choose('huge.jpg', 'image/jpeg');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'This photo could not be made smaller than 1 MB.',
      ),
    );
    expect(match).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the statement cannot be read", async () => {
    match.mockRejectedValueOnce(
      new Error('OCR.space could not read this document: Unable to parse image'),
    );
    renderUpload();
    await screen.findByRole('button', { name: /Upload statement/ });

    choose('statement.png', 'image/png');

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/Unable to parse image/),
    );
  });
});
