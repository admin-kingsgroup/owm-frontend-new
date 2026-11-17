import { describe, expect, it } from 'vitest';

import type { OcrStatementReading, OcrStatementRow } from '@/entities/ocr';

import { isStatementPhoto, photoReadingToLines } from './photo';

function reading(
  rows: Array<Partial<OcrStatementRow>>,
  balances: { opening?: string; closing?: string } = {},
): OcrStatementReading {
  return {
    provider: 'ocr_space',
    extracted_text: '',
    statement: {
      bank_name: null,
      account_number: null,
      period_from: null,
      period_to: null,
      opening_balance: balances.opening ?? null,
      closing_balance: balances.closing ?? null,
      rows: rows.map((row) => ({
        date: null,
        date_iso: null,
        description: null,
        reference: null,
        amount: null,
        direction: null,
        balance: null,
        ...row,
      })),
    },
    warnings: [],
    meta: {
      mime_type: 'image/jpeg',
      file_size_bytes: 1,
      dimensions: null,
      page_count: 1,
      duration_ms: 1,
      model: null,
      structured_by: 'pattern_rules',
      usage: null,
    },
  };
}

describe('a statement photo read by OCR', () => {
  it('puts each amount in the column its direction names, and checks the running balance', () => {
    const read = photoReadingToLines(
      reading(
        [
          {
            date: '03/11/2026',
            date_iso: '2026-11-03',
            description: 'NEFT-ACME PHARMA',
            reference: 'N3071234',
            amount: '25000.00',
            direction: 'deposit',
            balance: '75000.00',
          },
          {
            date_iso: '2026-11-05',
            description: 'CHQ PAID',
            reference: '000123',
            amount: '12500.00',
            direction: 'withdrawal',
            balance: '62500.00',
          },
        ],
        { opening: '50000.00', closing: '62500.00' },
      ),
    );

    expect(read.openingBalance).toBe('50000.00');
    expect(read.closingBalance).toBe('62500.00');
    expect(read.lines).toMatchObject([
      {
        txnDate: '2026-11-03',
        description: 'NEFT-ACME PHARMA',
        reference: 'N3071234',
        deposit: '25000.00',
        withdrawal: '',
        balance: '75000.00',
        issues: [],
      },
      { txnDate: '2026-11-05', withdrawal: '12500.00', deposit: '', issues: [] },
    ]);
  });

  it('never guesses a direction: the amount waits in a note and the line cannot be sent', () => {
    const [line] = photoReadingToLines(
      reading([{ date_iso: '2026-11-15', description: 'SMS CHARGES', amount: '17.70' }]),
    ).lines;

    expect(line.withdrawal).toBe('');
    expect(line.deposit).toBe('');
    expect(line.issues).toEqual([
      'Read 17.70, but not whether it went out or came in — enter it as a withdrawal or a deposit',
      'Needs exactly one of withdrawal or deposit',
    ]);
  });

  it('flags a printed date it could not read, rather than dropping the line', () => {
    const [line] = photoReadingToLines(
      reading([{ date: '85/11/2826', amount: '100.00', direction: 'deposit' }]),
    ).lines;

    expect(line.txnDate).toBe('');
    expect(line.issues).toContain('Could not read "85/11/2826" as a date — enter it');
    expect(line.issues).toContain('Needs a date');
  });

  it('turns a newest-first statement the right way round', () => {
    const { lines } = photoReadingToLines(
      reading([
        { date_iso: '2026-11-07', amount: '6216.00', direction: 'deposit' },
        { date_iso: '2026-11-03', amount: '25000.00', direction: 'deposit' },
      ]),
    );
    expect(lines.map((line) => line.txnDate)).toEqual(['2026-11-03', '2026-11-07']);
  });
});

describe('which files are photos', () => {
  const file = (name: string, type = '') => new File(['x'], name, { type });

  it('takes JPEG, PNG and iPhone HEIC, by type or by name', () => {
    expect(isStatementPhoto(file('statement.jpg', 'image/jpeg'))).toBe(true);
    expect(isStatementPhoto(file('IMG_0042.HEIC'))).toBe(true);
    expect(isStatementPhoto(file('scan.png'))).toBe(true);
  });

  it('leaves PDFs and spreadsheets to the readers that already handle them', () => {
    expect(isStatementPhoto(file('statement.pdf', 'application/pdf'))).toBe(false);
    expect(isStatementPhoto(file('statement.csv', 'text/csv'))).toBe(false);
  });
});
