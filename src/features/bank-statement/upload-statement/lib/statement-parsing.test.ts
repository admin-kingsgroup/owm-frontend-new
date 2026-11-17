// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { parseCamt } from './camt';
import { parseDelimited, parseHtmlTable } from './read-statement';
import {
  applyColumnMap,
  detectDateOrder,
  findHeaderRow,
  guessRoles,
  parseAmount,
  parseDate,
} from './statement-table';
import { wordsToRows } from './words-to-rows';
import type { PositionedWord } from './pdf';

describe('parseAmount', () => {
  it('reads the ways banks write money', () => {
    expect(parseAmount('1,25,000.00')?.value).toBe('125000.00');
    expect(parseAmount('₹ 500')?.value).toBe('500.00');
    expect(parseAmount('(300.00)')).toEqual({ value: '300.00', negative: true, marker: null });
    expect(parseAmount('-42.5')).toEqual({ value: '42.50', negative: true, marker: null });
    expect(parseAmount('1,234.00 Cr')).toEqual({ value: '1234.00', negative: false, marker: 'CR' });
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    // A third decimal that is not zero is a misreading, not a fraction of a paisa.
    expect(parseAmount('12.345')).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads common bank date styles into YYYY-MM-DD', () => {
    expect(parseDate('03/11/2026', 'DMY')).toBe('2026-11-03');
    expect(parseDate('03-11-26', 'DMY')).toBe('2026-11-03');
    expect(parseDate('11/03/2026', 'MDY')).toBe('2026-11-03');
    expect(parseDate('03 Nov 2026', 'DMY')).toBe('2026-11-03');
    expect(parseDate('03-NOV-2026', 'DMY')).toBe('2026-11-03');
    expect(parseDate('Nov 3, 2026', 'DMY')).toBe('2026-11-03');
    expect(parseDate('2026-11-03', 'DMY')).toBe('2026-11-03');
    expect(parseDate('46329', 'DMY')).toBe('2026-11-03');
    expect(parseDate('31/02/2026', 'DMY')).toBeNull();
    expect(parseDate('Opening Balance', 'DMY')).toBeNull();
  });

  it('assumes day first unless a date proves otherwise', () => {
    expect(detectDateOrder(['03/11/2026', '05/11/2026'])).toBe('DMY');
    expect(detectDateOrder(['11/13/2026'])).toBe('MDY');
    expect(detectDateOrder(['2026-11-03'])).toBe('YMD');
  });
});

describe('reading a bank table', () => {
  const csv = [
    'HDFC BANK Ltd.,,,,,,',
    'Account No: 50100012345678,,,,,,',
    ',,,,,,',
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '01/11/26,Opening Balance,,,,,"10,000.00"',
    '03/11/26,NEFT CR-ABC TRADERS,N307260012,03/11/26,,"12,000.00","22,000.00"',
    '09/11/26,CHQ PAID-MICR CTS,000456,09/11/26,"25,000.00",,"-3,000.00"',
    ',RENT NOV,,,,,',
    '30/11/26,SMS CHGS QTR,,30/11/26,118.00,,"-3,118.00"',
  ].join('\n');

  it('finds the header, guesses the columns and reads the lines', () => {
    const rows = parseDelimited(csv);
    const headerRow = findHeaderRow(rows);
    expect(headerRow).toBe(3);

    const roles = guessRoles(rows[headerRow]);
    expect(roles).toEqual([
      'date',
      'description',
      'reference',
      'valueDate',
      'withdrawal',
      'deposit',
      'balance',
    ]);

    const read = applyColumnMap(rows, { headerRow, roles, dateOrder: 'DMY' });
    expect(read.openingBalance).toBe('10000.00');
    expect(read.lines).toHaveLength(3);
    expect(read.lines[0]).toMatchObject({
      txnDate: '2026-11-03',
      description: 'NEFT CR-ABC TRADERS',
      reference: 'N307260012',
      deposit: '12000.00',
      withdrawal: '',
      balance: '22000.00',
    });
    // The wrapped narration joins the line above it.
    expect(read.lines[1].description).toBe('CHQ PAID-MICR CTS RENT NOV');
    expect(read.lines[1].withdrawal).toBe('25000.00');
    // Every line agrees with the running balance.
    expect(read.lines.flatMap((line) => line.issues)).toEqual([]);
  });

  it('points at a line whose figure breaks the running balance', () => {
    // 118 misread as 113 — exactly the kind of slip OCR makes.
    const rows = parseDelimited(csv.replace('118.00,', '113.00,'));
    const headerRow = findHeaderRow(rows);
    const read = applyColumnMap(rows, {
      headerRow,
      roles: guessRoles(rows[headerRow]),
      dateOrder: 'DMY',
    });
    expect(read.lines[2].issues[0]).toMatch(/Running balance does not agree/);
    expect(read.lines[0].issues).toEqual([]);
  });

  it('reads one amount column with a Dr/Cr marker, and puts newest-first statements in order', () => {
    const rows = parseDelimited(
      [
        'Txn Date;Description;Amount;Dr/Cr;Balance',
        '05-11-2026;UPI-SWIGGY;450.00;DR;9,550.00 Cr',
        '02-11-2026;SALARY;10,000.00;CR;10,000.00 Cr',
      ].join('\n'),
    );
    const roles = guessRoles(rows[0]);
    expect(roles).toEqual(['date', 'description', 'amount', 'drCr', 'balance']);
    const read = applyColumnMap(rows, { headerRow: 0, roles, dateOrder: 'DMY' });
    expect(read.lines.map((line) => line.txnDate)).toEqual(['2026-11-02', '2026-11-05']);
    expect(read.lines[0].deposit).toBe('10000.00');
    expect(read.lines[1].withdrawal).toBe('450.00');
    expect(read.lines[1].issues).toEqual([]);
  });

  it('reads the table out of an "Excel" file that is really a web page', () => {
    const rows = parseHtmlTable(
      '<html><body><table><tr><th>Date</th><th>Debit</th></tr><tr><td>01/11/2026</td><td>5.00</td></tr></table></body></html>',
    );
    expect(rows).toEqual([
      ['Date', 'Debit'],
      ['01/11/2026', '5.00'],
    ]);
  });
});

describe('camt.053', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><Othr><Id>50100012345678</Id></Othr></Id></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="INR">10000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="INR">21882.00</Amt><CdtDbtInd>CRDT</CdtDbtInd></Bal>
      <Ntry>
        <Amt Ccy="INR">12000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts>
        <BookgDt><Dt>2026-11-03</Dt></BookgDt><ValDt><Dt>2026-11-03</Dt></ValDt>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>N307260012</EndToEndId></Refs>
          <RltdPties><Dbtr><Nm>ABC TRADERS</Nm></Dbtr></RltdPties>
          <RmtInf><Ustrd>INV 1043</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="INR">118.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts>
        <BookgDt><DtTm>2026-11-30T10:00:00</DtTm></BookgDt>
        <AddtlNtryInf>SMS CHGS QTR</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt Ccy="INR">50.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>PDNG</Sts>
        <BookgDt><Dt>2026-11-30</Dt></BookgDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

  it('reads entries, balances and references, and leaves pending entries out', () => {
    const read = parseCamt(xml);
    expect(read.openingBalance).toBe('10000.00');
    expect(read.closingBalance).toBe('21882.00');
    expect(read.lines).toHaveLength(3);
    expect(read.lines[0]).toMatchObject({
      txnDate: '2026-11-03',
      deposit: '12000.00',
      reference: 'N307260012',
      description: 'ABC TRADERS · INV 1043',
      include: true,
    });
    expect(read.lines[1]).toMatchObject({
      txnDate: '2026-11-30',
      withdrawal: '118.00',
      description: 'SMS CHGS QTR',
    });
    expect(read.lines[2].include).toBe(false);
  });

  it('refuses XML that is not a bank statement', () => {
    expect(() => parseCamt('<Invoice><Total>5</Total></Invoice>')).toThrow(/camt\.053/);
  });
});

describe('rebuilding a PDF table from word positions', () => {
  const word = (text: string, x0: number, y: number): PositionedWord => ({
    text,
    x0,
    x1: x0 + text.length * 5,
    y0: y,
    y1: y + 10,
  });

  it('puts each word under the heading it sits beneath', () => {
    const page = [
      word('State Bank of India', 40, 20),
      word('Date', 40, 60),
      word('Description', 120, 60),
      word('Debit', 340, 60),
      word('Credit', 420, 60),
      word('Balance', 500, 60),
      word('03/11/2026', 40, 80),
      word('NEFT', 120, 80),
      word('ABC TRADERS', 145, 80),
      word('12,000.00', 410, 80),
      word('22,000.00', 495, 80),
      word('30/11/2026', 40, 100),
      word('SMS CHGS', 120, 100),
      word('118.00', 340, 100),
      word('21,882.00', 495, 100),
    ];
    const rows = wordsToRows([page]);
    const headerRow = findHeaderRow(rows);
    expect(rows[headerRow]).toEqual(['Date', 'Description', 'Debit', 'Credit', 'Balance']);
    expect(rows[headerRow + 1]).toEqual([
      '03/11/2026',
      'NEFT ABC TRADERS',
      '',
      '12,000.00',
      '22,000.00',
    ]);
    expect(rows[headerRow + 2]).toEqual(['30/11/2026', 'SMS CHGS', '118.00', '', '21,882.00']);

    const read = applyColumnMap(rows, {
      headerRow,
      roles: guessRoles(rows[headerRow]),
      dateOrder: 'DMY',
    });
    expect(read.lines.map((line) => [line.withdrawal, line.deposit])).toEqual([
      ['', '12000.00'],
      ['118.00', ''],
    ]);
  });

  /*
    The layout of an ICICI statement PDF, as uploaded: headings wrapped over four lines, dates
    written 31,05,2026, two date columns side by side, UPI remarks wrapping over several lines
    with the serial number centred in the row, a cheque column nobody used, figures right-aligned,
    and a footer under the table.
  */
  it('reads a statement whose headings and remarks wrap over several lines', () => {
    const at = (text: string, x0: number, y: number): PositionedWord => ({
      text,
      x0,
      x1: x0 + text.length * 3.5,
      y0: y,
      y1: y + 8,
    });
    /** A figure printed right-aligned, ending at `right`. */
    const figure = (text: string, right: number, y: number) =>
      at(text, right - text.length * 3.5, y);

    const page = [
      at('Statement of Transactions in Savings Account', 30, 40),
      // Headings, four lines deep.
      at('S No.', 30, 100),
      at('Value Date', 60, 100),
      at('Transactio', 120, 100),
      at('Cheque', 180, 100),
      at('Transaction Remarks', 240, 100),
      at('Withdraw', 410, 100),
      at('Deposit', 480, 100),
      at('Balance', 560, 100),
      at('n Date', 120, 110),
      at('Number', 180, 110),
      at('al', 410, 110),
      at('Amount', 480, 110),
      at('(INR)', 560, 110),
      at('Amount(I', 410, 120),
      at('(INR)', 480, 120),
      at('NR)', 410, 130),
      // 1 — remarks over four lines, serial number on the third.
      at('31,05,2026 31,05,2026', 60, 150),
      at('UPI/Naturals N/paytm-0837379@/ice cream/YES', 240, 150),
      figure('100.00', 470, 150),
      figure('9,900.00', 620, 150),
      at('BANK', 240, 160),
      at('1', 30, 170),
      at('L/651738228995/ICI3d7f', 240, 170),
      at('7a6b/', 240, 180),
      // 2 — one line, interest credited.
      at('2', 30, 195),
      at('29,06,2026', 60, 195),
      at('30,06,2026', 120, 195),
      at('333801001692:Int.Pd:30-03-2026 to 29-06-20', 240, 195),
      figure('52.00', 540, 195),
      figure('9,952.00', 620, 195),
      // 3 — two lines.
      at('10,07,2026', 60, 210),
      at('10,07,2026', 120, 210),
      at('UPI/LENSKART/lenskartoffl', 240, 210),
      figure('4,099.00', 470, 210),
      figure('5,853.00', 620, 210),
      at('3', 30, 220),
      at('BANK', 240, 220),
      // Footer, well below the table.
      at('Page 1 of 1', 300, 400),
    ];

    const rows = wordsToRows([page]);
    const headerRow = findHeaderRow(rows);
    expect(headerRow).toBe(0);
    const roles = guessRoles(rows[0]);
    const roleOf = (name: string) =>
      roles[rows[0].findIndex((cell) => cell.toLowerCase().includes(name))];
    expect(roleOf('value')).toBe('valueDate');
    expect(roleOf('transactio n')).toBe('date');
    expect(roleOf('cheque')).toBe('reference');
    expect(roleOf('remarks')).toBe('description');
    expect(roleOf('withdraw')).toBe('withdrawal');
    expect(roleOf('deposit')).toBe('deposit');
    expect(roleOf('balance')).toBe('balance');

    const read = applyColumnMap(rows, { headerRow, roles, dateOrder: 'DMY' });
    expect(read.lines).toHaveLength(3);
    expect(read.lines[0]).toMatchObject({
      txnDate: '2026-05-31',
      description: 'UPI/Naturals N/paytm-0837379@/ice cream/YES BANK L/651738228995/ICI3d7f 7a6b/',
      withdrawal: '100.00',
      deposit: '',
    });
    expect(read.lines[1]).toMatchObject({
      txnDate: '2026-06-30',
      valueDate: '2026-06-29',
      deposit: '52.00',
    });
    expect(read.lines[2]).toMatchObject({
      txnDate: '2026-07-10',
      description: 'UPI/LENSKART/lenskartoffl BANK',
      withdrawal: '4099.00',
    });
    // The running balance agrees on every line: nothing was misplaced between columns.
    expect(read.lines.flatMap((line) => line.issues)).toEqual([]);
  });
});
