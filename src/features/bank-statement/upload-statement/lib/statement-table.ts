/**
 * Turning a bank's table — from a CSV, an Excel sheet or a PDF — into statement lines.
 *
 * Every bank lays its statement out differently: "Withdrawal Amt." and "Deposit Amt." in two
 * columns, or one "Amount" column with a "Dr/Cr" beside it, or a signed amount; dates as
 * 03/11/2026, 03-Nov-26 or an Excel day number; a block of account details above the header and a
 * "Closing balance" row below the last line. So the table is read in three steps a person can see
 * and correct: find the header row, guess what each column is (`guessRoles`), then read the lines
 * with that mapping (`applyColumnMap`). The guesses are only a starting point — the upload screen
 * lets the person change any of them.
 */

export type ColumnRole =
  | 'ignore'
  | 'date'
  | 'valueDate'
  | 'description'
  | 'reference'
  | 'withdrawal'
  | 'deposit'
  | 'amount'
  | 'drCr'
  | 'balance';

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  ignore: '— not used —',
  date: 'Date',
  valueDate: 'Value date',
  description: 'Description',
  reference: 'Cheque / Ref no.',
  withdrawal: 'Withdrawal (money out)',
  deposit: 'Deposit (money in)',
  amount: 'Amount (one column)',
  drCr: 'Dr / Cr marker',
  balance: 'Balance',
};

/** How a date is written when it is all numbers: 03/11/2026 is 3 November in India, 11 March in the US. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

export interface ColumnMap {
  /** Index of the header row in the file's rows. Lines are read from the row after it. */
  headerRow: number;
  /** What each column holds, by position. */
  roles: ColumnRole[];
  dateOrder: DateOrder;
}

/** What is saved with an upload, so the next file from the same bank opens already mapped. */
export interface SavedColumnMap {
  headers: string[];
  roles: ColumnRole[];
  dateOrder: DateOrder;
}

/** One line as read, before the person checks it. */
export interface DraftLine {
  key: string;
  include: boolean;
  /** `YYYY-MM-DD`, or '' when the date could not be read. */
  txnDate: string;
  valueDate: string;
  description: string;
  reference: string;
  /** Normalised amounts, "1234.50", or '' for none. */
  withdrawal: string;
  deposit: string;
  balance: string;
  /** Problems a person should look at; the line can still be sent once they are fixed. */
  issues: string[];
}

export interface ReadLines {
  lines: DraftLine[];
  openingBalance?: string;
  closingBalance?: string;
}

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const clean = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ header and roles */

function headerScore(row: string[]): number {
  let score = 0;
  let hasDate = false;
  let hasMoney = false;
  for (const cell of row) {
    const text = clean(cell).toLowerCase();
    // A heading is a few words. A long cell, or one carrying a long number, is a line's data.
    if (!text || text.length > 40 || /\d{3,}/.test(text)) continue;
    if (/\bdate\b|\bdt\b/.test(text)) {
      hasDate = true;
      score += 1;
    }
    if (/withdraw|deposit|debit|credit|amount|\bamt\b|balance|\bdr\b|\bcr\b/.test(text)) {
      hasMoney = true;
      score += 1;
    }
    if (/narration|description|particular|details|remarks?|chq|cheque|ref/.test(text)) score += 1;
  }
  return hasDate && hasMoney ? score : 0;
}

/** Whether a row reads as a statement's column headings. */
export function looksLikeHeader(row: string[]): boolean {
  return headerScore(row) >= 2;
}

/**
 * The row that names the columns: one with a date heading and a money heading. The earliest of
 * the strongest candidates wins — the header comes before the lines, so a line whose words
 * happen to read like headings ("CREDIT INTEREST REF…") further down cannot take its place.
 */
export function findHeaderRow(rows: string[][]): number {
  const scores = rows.slice(0, 60).map(headerScore);
  const best = Math.max(0, ...scores);
  if (best < 2) return -1;
  return scores.findIndex((score) => score >= Math.max(2, best - 1));
}

/** A first guess at each column from its heading. The person can change any of them. */
export function guessRoles(header: string[]): ColumnRole[] {
  const taken = new Set<ColumnRole>();
  const once = (role: ColumnRole): ColumnRole => {
    if (taken.has(role)) return 'ignore';
    taken.add(role);
    return role;
  };

  return header.map((cell) => {
    const text = clean(cell).toLowerCase();
    if (!text) return 'ignore';
    if (
      /^(dr|cr)\s*\/\s*(cr|dr)$|debit\s*\/\s*credit|credit\s*\/\s*debit|^type$|txn type|cr\/dr|dr\/cr/.test(
        text,
      )
    )
      return once('drCr');
    if (/\bval(ue)?\.?\s*(date|dt)\b/.test(text)) return once('valueDate');
    if (/balance|\bbal\b/.test(text)) return once('balance');
    if (/withdraw|debit|\bdr\b|paid out|money out/.test(text)) return once('withdrawal');
    if (/deposit|credit|\bcr\b|paid in|money in/.test(text)) return once('deposit');
    if (/\bdate\b|\bdt\b/.test(text)) return once('date');
    if (/chq|cheque|check|ref|utr|instrument/.test(text)) return once('reference');
    if (/narration|description|particular|details|remark|transaction/.test(text))
      return once('description');
    if (/amount|\bamt\b/.test(text)) return once('amount');
    return 'ignore';
  });
}

/** Whether a saved mapping fits this file's header, so it can be reused as it is. */
export function savedMapFits(saved: SavedColumnMap | null | undefined, header: string[]): boolean {
  if (!saved || saved.headers.length !== header.length) return false;
  return saved.headers.every(
    (name, index) => clean(name).toLowerCase() === clean(header[index]).toLowerCase(),
  );
}

/* ------------------------------------------------------------------ values */

export interface ParsedAmount {
  /** Always positive, two decimals. */
  value: string;
  negative: boolean;
  /** A "Cr" or "Dr" written after the figure, as many banks print balances. */
  marker: 'CR' | 'DR' | null;
}

/**
 * Reads an amount as a bank writes it: "1,25,000.00", "₹ 500", "(300.00)", "-42.5", "1,234.00 Cr".
 * Returns null for an empty cell or anything that is not a number. Done on the text, never through
 * a float, so 0.1 + 0.2 never happens to anybody's money.
 */
export function parseAmount(raw: string | undefined): ParsedAmount | null {
  let text = clean(raw).toUpperCase();
  if (!text || text === '-' || text === '—') return null;

  let marker: ParsedAmount['marker'] = null;
  const suffix = text.match(/\s*(CR|DR)\.?$/);
  if (suffix) {
    marker = suffix[1] as 'CR' | 'DR';
    text = text.slice(0, suffix.index).trim();
  }
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/₹|RS\.?|INR/g, '').replace(/[,\s]/g, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(text) && !/^\d+\.$/.test(text)) return null;

  const [whole, fraction = ''] = text.split('.');
  // Banks print two decimals. A third is a reading error, not a fraction of a paisa.
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) return null;
  const value = `${String(Number(whole || '0'))}.${fraction.slice(0, 2).padEnd(2, '0')}`;
  return { value, negative, marker };
}

/** An amount in paise, as a whole number — safe up to 90 trillion rupees, which will do. */
export function toPaise(value: string): number {
  if (!value) return 0;
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  return negative ? -paise : paise;
}

export function fromPaise(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

/**
 * Reads a date as a bank writes it, into `YYYY-MM-DD`: "03/11/2026", "03-11-26", "03 Nov 2026",
 * "03-NOV-2026", "2026-11-03", "Nov 3, 2026", or an Excel day number like "46329".
 */
export function parseDate(raw: string | undefined, order: DateOrder): string | null {
  const text = clean(raw).toUpperCase();
  if (!text) return null;

  // An Excel cell holding a date comes out as the day count from 1899-12-30.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
      return date.toISOString().slice(0, 10);
    }
    return null;
  }

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[-/. ]+([A-Z]{3,9})\.?[-/., ]+(\d{2,4})/);
  if (match && MONTHS[match[2].slice(0, 3)] !== undefined) {
    return validDate(fullYear(Number(match[3])), MONTHS[match[2].slice(0, 3)], Number(match[1]));
  }

  match = text.match(/^([A-Z]{3,9})\.?[-/. ]+(\d{1,2}),?[-/. ]+(\d{2,4})/);
  if (match && MONTHS[match[1].slice(0, 3)] !== undefined) {
    return validDate(fullYear(Number(match[3])), MONTHS[match[1].slice(0, 3)], Number(match[2]));
  }

  // Commas too: some banks print 31,05,2026. Only with a four-digit year, so that an Indian
  // amount like 1,00,000 is never taken for a date.
  match = text.match(/^(\d{1,2})([-/.,])(\d{1,2})\2(\d{2,4})(?!\d)/);
  if (match && !(match[2] === ',' && match[4].length !== 4)) {
    const a = Number(match[1]);
    const b = Number(match[3]);
    const year = fullYear(Number(match[4]));
    return order === 'MDY' ? validDate(year, a, b) : validDate(year, b, a);
  }

  match = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (match) {
    return order === 'MDY'
      ? validDate(Number(match[3]), Number(match[1]), Number(match[2]))
      : validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  return null;
}

/**
 * Day-first unless the dates themselves prove otherwise (a "13" can only be a day). Decided by a
 * count over the whole column, so one odd cell cannot flip it.
 */
export function detectDateOrder(values: string[]): DateOrder {
  let yearFirst = 0;
  let numeric = 0;
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    const text = clean(value);
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(text)) {
      yearFirst += 1;
      continue;
    }
    const match = text.match(/^(\d{1,2})[-/.,](\d{1,2})[-/.,]\d{2,4}/);
    if (!match) continue;
    numeric += 1;
    if (Number(match[1]) > 12) dayFirst = true;
    if (Number(match[2]) > 12) monthFirst = true;
  }
  if (yearFirst > numeric) return 'YMD';
  return monthFirst && !dayFirst ? 'MDY' : 'DMY';
}

/* ------------------------------------------------------------------ reading the lines */

/** Text in a row that is a page footer or a heading, never part of a line's description. */
const NOT_A_CONTINUATION =
  /page\s*\d|statement of|continued|generated|computer|this is a system|closing balance|opening balance|^total|grand total|carried forward|brought forward/i;

const OPENING = /opening\s*balance|balance\s*b\/?f|brought\s*forward/i;
const CLOSING = /closing\s*balance|balance\s*c\/?f|carried\s*forward/i;

let keySeed = 0;
export const nextKey = () => `l${(keySeed += 1)}`;

export function emptyLine(): DraftLine {
  return {
    key: nextKey(),
    include: true,
    txnDate: '',
    valueDate: '',
    description: '',
    reference: '',
    withdrawal: '',
    deposit: '',
    balance: '',
    issues: [],
  };
}

function balanceOf(parsed: ParsedAmount | null): string {
  if (!parsed) return '';
  const negative = parsed.marker === 'DR' ? !parsed.negative : parsed.negative;
  return negative && parsed.value !== '0.00' ? `-${parsed.value}` : parsed.value;
}

/** Reads the lines of a table with a mapping, then checks them (`checkLines`). */
export function applyColumnMap(rows: string[][], map: ColumnMap): ReadLines {
  const at = (row: string[], role: ColumnRole): string => {
    const parts: string[] = [];
    map.roles.forEach((each, index) => {
      if (each === role && clean(row[index])) parts.push(clean(row[index]));
    });
    return parts.join(' ');
  };
  const has = (role: ColumnRole) => map.roles.includes(role);

  const lines: DraftLine[] = [];
  let openingBalance: string | undefined;
  let closingBalance: string | undefined;

  for (let index = map.headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.every((cell) => !clean(cell))) continue;
    const rowText = row.map(clean).join(' ');

    const dateText = at(row, 'date');
    const txnDate = parseDate(dateText, map.dateOrder);
    const description = at(row, 'description');

    let withdrawal = '';
    let deposit = '';
    let problem = '';

    if (has('withdrawal') || has('deposit')) {
      const out = parseAmount(at(row, 'withdrawal'));
      const into = parseAmount(at(row, 'deposit'));
      if (at(row, 'withdrawal') && !out)
        problem = `Could not read the withdrawal "${at(row, 'withdrawal')}"`;
      if (at(row, 'deposit') && !into)
        problem = `Could not read the deposit "${at(row, 'deposit')}"`;
      if (out && out.value !== '0.00') withdrawal = out.value;
      if (into && into.value !== '0.00') deposit = into.value;
    } else if (has('amount')) {
      const amount = parseAmount(at(row, 'amount'));
      if (at(row, 'amount') && !amount)
        problem = `Could not read the amount "${at(row, 'amount')}"`;
      if (amount && amount.value !== '0.00') {
        const marker = at(row, 'drCr').toUpperCase();
        const isOut =
          has('drCr') && marker
            ? /^D|DEBIT|WITHDRAW/.test(marker)
            : amount.marker
              ? amount.marker === 'DR'
              : amount.negative;
        if (isOut) withdrawal = amount.value;
        else deposit = amount.value;
      }
    }

    const balance = balanceOf(parseAmount(at(row, 'balance')));

    if (!txnDate) {
      // Opening and closing balance rows: kept as figures, not as lines.
      if (OPENING.test(rowText) && balance) openingBalance ??= balance;
      if (CLOSING.test(rowText) && balance) closingBalance = balance;
      // A row with only words in it continues the description above (long narrations wrap).
      const previous = lines[lines.length - 1];
      if (
        previous &&
        description &&
        !withdrawal &&
        !deposit &&
        !dateText &&
        !NOT_A_CONTINUATION.test(rowText)
      ) {
        previous.description = `${previous.description} ${description}`.trim();
        const reference = at(row, 'reference');
        if (reference) previous.reference = `${previous.reference}${reference}`;
      }
      continue;
    }

    if (!withdrawal && !deposit) {
      // A dated row with no money in it: the opening balance line many banks print first.
      if (OPENING.test(rowText) && balance) openingBalance ??= balance;
      continue;
    }

    const line = emptyLine();
    line.txnDate = txnDate;
    line.valueDate = parseDate(at(row, 'valueDate'), map.dateOrder) ?? '';
    line.description = description;
    line.reference = at(row, 'reference');
    line.withdrawal = withdrawal;
    line.deposit = deposit;
    line.balance = balance;
    if (problem) line.issues.push(problem);
    lines.push(line);
  }

  return checkLines({ lines, openingBalance, closingBalance });
}

/**
 * Puts the lines in date order (only on first reading — `reorder` is off once a person is editing,
 * so a row never jumps away from under them) and checks them against the bank's own running balance.
 *
 * The balance column is the best proof-reader there is: if yesterday's balance, less what went out
 * and plus what came in, is not today's balance, then one of the figures on the line was misread —
 * which with OCR happens (an 8 read as a 3). Each line that breaks the chain is flagged.
 */
export function checkLines(read: ReadLines, reorder = true): ReadLines {
  let lines = read.lines.map((line) => ({
    ...line,
    issues: line.issues.filter(
      (issue) => !issue.startsWith('Running balance') && !issue.startsWith('Needs'),
    ),
  }));

  // Some banks list the newest line first. Reading it backwards puts it the right way round.
  if (
    reorder &&
    lines.length > 1 &&
    lines[0].txnDate &&
    lines[lines.length - 1].txnDate &&
    lines[0].txnDate > lines[lines.length - 1].txnDate
  ) {
    lines = lines.reverse();
  }

  let previousBalance: number | null = read.openingBalance ? toPaise(read.openingBalance) : null;
  for (const line of lines) {
    if (!line.include) continue;
    if (!line.txnDate) line.issues.push('Needs a date');
    if (!line.withdrawal === !line.deposit)
      line.issues.push('Needs exactly one of withdrawal or deposit');

    if (line.balance) {
      const balance = toPaise(line.balance);
      if (previousBalance !== null) {
        const expected = previousBalance - toPaise(line.withdrawal) + toPaise(line.deposit);
        // An overdraft printed without a minus sign still agrees if the sign is all that differs.
        if (expected !== balance && expected !== -balance) {
          line.issues.push(
            `Running balance does not agree: expected ${fromPaise(expected)}, statement says ${line.balance}`,
          );
        }
      }
      previousBalance = balance;
    } else if (previousBalance !== null) {
      previousBalance = previousBalance - toPaise(line.withdrawal) + toPaise(line.deposit);
    }
  }

  return { ...read, lines };
}

/** Totals of the included lines, for the summary above the review table. */
export function totalsOf(lines: DraftLine[]): {
  count: number;
  withdrawals: string;
  deposits: string;
  issues: number;
} {
  let withdrawals = 0;
  let deposits = 0;
  let count = 0;
  let issues = 0;
  for (const line of lines) {
    if (!line.include) continue;
    count += 1;
    withdrawals += toPaise(line.withdrawal);
    deposits += toPaise(line.deposit);
    if (line.issues.length) issues += 1;
  }
  return { count, withdrawals: fromPaise(withdrawals), deposits: fromPaise(deposits), issues };
}
