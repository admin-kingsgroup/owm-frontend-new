import { describe, expect, it } from 'vitest';

import type { BookLine, StatementLine, StatementWorkspace } from '@/entities/bank-statement';

import { buildRows, gapFigures, inPeriod, matchesSearch, statementBalance } from './board';

const at = (date: string) => `${date}T00:00:00.000Z`;

const book = (entryId: string, date: string, debit: number, credit: number, extra: Partial<BookLine> = {}): BookLine => ({
  entryId,
  voucherId: `v-${entryId}`,
  voucherNumber: `VCH/${entryId}`,
  voucherDate: at(date),
  voucherType: debit ? 'Receipt' : 'Payment',
  voucherStatus: 'POSTED',
  particulars: `Party ${entryId}`,
  debit: debit.toFixed(2),
  credit: credit.toFixed(2),
  ...extra,
});

const bank = (id: string, date: string, withdrawal: number, deposit: number, extra: Partial<StatementLine> = {}): StatementLine => ({
  id,
  statementId: 's1',
  txnDate: at(date),
  description: `LINE ${id}`,
  withdrawal: withdrawal.toFixed(2),
  deposit: deposit.toFixed(2),
  status: 'UNMATCHED',
  ...extra,
});

const workspace = (bookLines: BookLine[], lines: StatementLine[]): StatementWorkspace => ({
  ledger: { id: 'l1', code: 'HDFC', name: 'HDFC Bank' },
  statements: [],
  lastColumnMap: null,
  lines,
  counts: { UNMATCHED: 0, SUGGESTED: 0, MATCHED: 0, VOUCHER_CREATED: 0, IGNORED: 0 },
  bookLines,
});

describe('buildRows', () => {
  it('puts each bank line beside its book line, and leaves the rest one-sided', () => {
    const ws = workspace(
      [
        book('b1', '2026-10-01', 118000, 0, { reconciledOn: at('2026-10-01') }),
        book('b2', '2026-10-07', 0, 236000),
        book('b3', '2026-10-28', 0, 38500),
        book('b4', '2026-10-20', 0, 590, { voucherStatus: 'DRAFT', voucherId: 'draft-1' }),
      ],
      [
        bank('k1', '2026-10-01', 0, 118000, { status: 'MATCHED', entryId: 'b1' }),
        bank('k2', '2026-10-07', 236000, 0, { status: 'SUGGESTED', entryId: 'b2' }),
        bank('k3', '2026-10-20', 590, 0, {
          status: 'VOUCHER_CREATED',
          voucher: { id: 'draft-1', voucherNumber: 'PMT/9', voucherDate: at('2026-10-20'), status: 'DRAFT' },
        }),
        bank('k4', '2026-10-31', 0, 1245),
        bank('k5', '2026-10-15', 10, 0, { status: 'IGNORED' }),
      ],
    );

    const rows = buildRows(ws);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));

    expect(byKey['line:k1']).toMatchObject({ status: 'matched', book: { entryId: 'b1' } });
    expect(byKey['line:k2']).toMatchObject({ status: 'suggested', book: { entryId: 'b2' } });
    expect(byKey['line:k3']).toMatchObject({ status: 'draft', book: { entryId: 'b4' } });
    expect(byKey['line:k4'].status).toBe('bank-only');
    expect(byKey['line:k4'].book).toBeUndefined();
    expect(byKey['line:k5'].status).toBe('ignored');
    expect(byKey['entry:b3'].status).toBe('books-only');
    expect(byKey['entry:b3'].line).toBeUndefined();
    // Nothing shown twice.
    expect(rows).toHaveLength(6);
    // In date order.
    expect(rows.map((row) => row.date)).toEqual([...rows.map((row) => row.date)].sort());
  });
});

describe('inPeriod', () => {
  const ws = workspace(
    [book('old', '2026-08-10', 0, 5000), book('sep', '2026-09-05', 1000, 0, { reconciledOn: at('2026-09-06') })],
    [
      bank('done', '2026-09-06', 0, 1000, { status: 'MATCHED', entryId: 'sep' }),
      bank('late', '2026-11-02', 0, 700),
    ],
  );
  const rows = Object.fromEntries(buildRows(ws).map((row) => [row.key, row]));

  it('keeps an old open item, drops what was settled before the period and what comes after it', () => {
    expect(inPeriod(rows['entry:old'], '2026-10-01', '2026-10-31')).toBe(true);
    expect(inPeriod(rows['line:done'], '2026-10-01', '2026-10-31')).toBe(false);
    expect(inPeriod(rows['line:done'], '2026-09-01', '2026-09-30')).toBe(true);
    expect(inPeriod(rows['line:late'], '2026-10-01', '2026-10-31')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('finds a row by party, by reference, and by amount typed with commas', () => {
    const [row] = buildRows(
      workspace([book('b1', '2026-10-01', 150000, 0)], [bank('k1', '2026-10-01', 0, 150000, { status: 'MATCHED', entryId: 'b1', reference: 'N281190' })]),
    );
    expect(matchesSearch(row, 'party b1')).toBe(true);
    expect(matchesSearch(row, 'n2811')).toBe(true);
    expect(matchesSearch(row, '1,50,000')).toBe(true);
    expect(matchesSearch(row, 'kumar')).toBe(false);
  });
});

describe('statementBalance', () => {
  it('takes the running balance of the last line on or before the day', () => {
    const ws = workspace([], [
      bank('a', '2026-10-30', 0, 10, { balance: '500.00' }),
      bank('b', '2026-10-31', 0, 10, { balance: '510.00' }),
      bank('c', '2026-11-02', 0, 10, { balance: '520.00' }),
    ]);
    expect(statementBalance(ws, '2026-10-31')).toEqual({ amount: 51000, date: '2026-10-31' });
  });

  it("falls back to an upload's closing balance, and says nothing when neither is known", () => {
    const ws = workspace([], [bank('a', '2026-10-30', 0, 10)]);
    expect(statementBalance(ws, '2026-10-31')).toBeNull();
    ws.statements = [
      { id: 's1', fileName: 'oct.csv', format: 'CSV', toDate: at('2026-10-31'), closingBalance: '82905.00', lineCount: 1, createdAt: at('2026-11-01') },
    ];
    expect(statementBalance(ws, '2026-10-31')).toEqual({ amount: 8290500, date: '2026-10-31' });
  });
});

describe('gapFigures', () => {
  it('bridges the books to the bank to the paisa', () => {
    // Books 85,750 Dr. A cheque of 38,500 not presented, a deposit of 64,000 not credited;
    // the bank took 590 in charges and paid 1,245 interest the books do not have yet.
    const ws = workspace([], [
      bank('chg', '2026-10-20', 590, 0),
      bank('int', '2026-10-31', 0, 1245),
      bank('ok', '2026-10-05', 45000, 0, { status: 'MATCHED' }),
      bank('ign', '2026-10-06', 99, 0, { status: 'IGNORED' }),
      bank('next', '2026-11-03', 38500, 0),
    ]);
    const gap = gapFigures(
      {
        balanceAsPerBooks: '85750.00',
        balanceAsPerBooksSide: 'DEBIT',
        unreconciled: [
          { debit: '0.00', credit: '38500.00' },
          { debit: '64000.00', credit: '0.00' },
        ],
        totals: { unreconciledDebits: '64000.00', unreconciledCredits: '38500.00' },
      },
      ws,
      '2026-10-31',
    );
    expect(gap).toMatchObject({
      books: 8575000,
      notPresented: 3850000,
      notPresentedCount: 1,
      notCredited: 6400000,
      notCreditedCount: 1,
      bankIn: 124500,
      bankInCount: 1,
      bankOut: 59000,
      bankOutCount: 1,
    });
    // 85,750 + 38,500 − 64,000 + 1,245 − 590
    expect(gap.expected).toBe(6090500);
  });
});
