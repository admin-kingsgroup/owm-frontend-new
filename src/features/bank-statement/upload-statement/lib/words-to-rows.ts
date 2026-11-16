import type { PositionedWord } from './pdf';
import { looksLikeHeader, parseDate } from './statement-table';

/**
 * Rebuilds the table a PDF statement prints, from words and where they sit on the page.
 *
 * A PDF has no rows or columns — only text placed at positions — and real statements make the
 * obvious approach fail in two ways at once:
 *
 * - **Headings wrap.** "Withdrawal Amount (INR)" in a narrow column is four lines: "Withdraw",
 *   "al", "Amount(I", "NR)". No single line of the heading says where the columns are.
 * - **Lines wrap.** A UPI remark runs to three or four lines inside its cell, while the date and
 *   the amounts sit on the first of them and the serial number floats in the middle. Read line by
 *   line, one transaction becomes four rows, three of them with no date and no amount.
 *
 * So the table is rebuilt the way a person reads it:
 *
 * 1. **A transaction starts where a date sits in the date column.** Every line in which a date is
 *    the first thing at the date column's position starts one; the lines below it, until the next
 *    such line, belong to it (a remark wrapping, a serial number centred in a tall row).
 * 2. **Columns are the gaps that run straight down the page.** Across every transaction's first
 *    line, an x position no word ever covers is a gap between columns. That does not depend on
 *    the heading at all, and it splits two dates printed side by side ("Value Date",
 *    "Transaction Date") that look like one cell on any single line.
 * 3. **Headings are what sits above the first transaction**, each word put in the column it is
 *    above, so a wrapped heading reads whole again: "Withdraw al Amount(I NR)".
 *
 * The result is plain rows of text — headings first — exactly what a CSV gives, so a PDF goes
 * through the same column naming and review as any other file. When no dated lines can be found,
 * a simpler line-by-line reading is used instead (`linesByHeader`).
 */

interface Line {
  words: PositionedWord[];
  top: number;
  bottom: number;
  page: number;
}

interface Column {
  x0: number;
  x1: number;
}

const median = (values: number[]) => {
  if (values.length === 0) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const middle = (word: { x0: number; x1: number }) => (word.x0 + word.x1) / 2;

/** Words at the same height, left to right. */
function groupLines(words: PositionedWord[], page: number): Line[] {
  const height = median(words.map((word) => word.y1 - word.y0));
  const tolerance = Math.max(2, height * 0.5);
  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);

  const lines: Line[] = [];
  let current: PositionedWord[] = [];
  let center = 0;
  const close = () => {
    if (current.length === 0) return;
    lines.push({
      words: current.sort((a, b) => a.x0 - b.x0),
      top: Math.min(...current.map((word) => word.y0)),
      bottom: Math.max(...current.map((word) => word.y1)),
      page,
    });
    current = [];
  };
  for (const word of sorted) {
    const mid = (word.y0 + word.y1) / 2;
    if (current.length > 0 && Math.abs(mid - center) > tolerance) close();
    current.push(word);
    center = current.reduce((sum, each) => sum + (each.y0 + each.y1) / 2, 0) / current.length;
  }
  close();
  return lines;
}

/** Whether a word, on its own, is a date: "31,05,2026", "03/11/26", "03-Nov-2026". */
function isDateWord(text: string): boolean {
  const word = text.trim();
  if (!/^\d{1,4}[-/.,\s]?[A-Za-z0-9]{1,9}[-/.,\s]?\d{2,4}$/.test(word)) return false;
  return parseDate(word, 'DMY') !== null || parseDate(word, 'MDY') !== null;
}

/** The first date among a line's first few words, if any. */
function leadingDate(line: Line): PositionedWord | null {
  for (const word of line.words.slice(0, 4)) {
    // A date pdf.js handed over glued to its neighbour ("31,05,2026 31,05,2026") still counts.
    if (isDateWord(word.text) || isDateWord(word.text.split(/\s+/)[0])) return word;
  }
  return null;
}

/** Joins overlapping or touching spans into columns, left to right. */
function mergeSpans(spans: Column[], gap: number): Column[] {
  const sorted = [...spans].sort((a, b) => a.x0 - b.x0);
  const merged: Column[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.x0 <= last.x1 + gap) last.x1 = Math.max(last.x1, span.x1);
    else merged.push({ ...span });
  }
  return merged;
}

/**
 * The column a word belongs in. Each gap between two columns is split down its middle, so every
 * position on the line belongs to exactly one column — including a heading printed over the left
 * of a column whose figures are right-aligned, which no figure ever sits under.
 */
function columnOf(word: { x0: number; x1: number }, columns: Column[]): number {
  const mid = middle(word);
  for (let index = 0; index < columns.length - 1; index += 1) {
    if (mid < (columns[index].x1 + columns[index + 1].x0) / 2) return index;
  }
  return columns.length - 1;
}

const AMOUNT = /^[-(]?[\d,]*\d\.\d{2}\)?(cr|dr)?$/i;

/**
 * Splits a piece of text pdf.js handed over whole when it is really several figures side by side
 * — "31,05,2026 31,05,2026", a value date and a transaction date in two columns. Only when every
 * part is a date or an amount: words of a description stay together.
 */
function explode(word: PositionedWord): PositionedWord[] {
  const parts = word.text.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !parts.every((part) => isDateWord(part) || AMOUNT.test(part))) {
    return [word];
  }
  const perChar = (word.x1 - word.x0) / Math.max(1, word.text.length);
  const pieces: PositionedWord[] = [];
  let offset = 0;
  for (const part of parts) {
    const start = word.text.indexOf(part, offset);
    pieces.push({
      ...word,
      text: part,
      x0: word.x0 + start * perChar,
      x1: word.x0 + (start + part.length) * perChar,
    });
    offset = start + part.length;
  }
  return pieces;
}

function byDatedLines(pages: PositionedWord[][]): string[][] | null {
  const lines = pages.flatMap((words, page) => groupLines(words.flatMap(explode), page));
  const height = median(lines.flatMap((line) => line.words.map((word) => word.y1 - word.y0)));

  // Where the date column is: the commonest position of a line's leading date.
  const positions = new Map<number, number>();
  for (const line of lines) {
    const date = leadingDate(line);
    if (!date) continue;
    const bucket = Math.round(date.x0 / 6);
    positions.set(bucket, (positions.get(bucket) ?? 0) + 1);
  }
  const [bucket, votes] = [...positions.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  if (votes < 2) return null;
  const dateX = bucket * 6;
  const starts = new Set(
    lines.filter((line) => {
      const date = leadingDate(line);
      return date !== null && Math.abs(date.x0 - dateX) <= Math.max(6, height);
    }),
  );

  // Columns: the gaps no first line of a transaction ever covers.
  const columns = mergeSpans(
    [...starts].flatMap((line) => line.words.map((word) => ({ x0: word.x0, x1: word.x1 }))),
    Math.max(1.5, height * 0.3),
  );

  // Headings: the lines above the first transaction, from the one that reads like headings.
  const first = lines.findIndex((line) => starts.has(line));
  let headStart = -1;
  for (let index = first - 1; index >= 0 && index >= first - 8; index -= 1) {
    if (lines[index].page !== lines[first].page) break;
    if (looksLikeHeader(lines[index].words.map((word) => word.text))) headStart = index;
  }
  const headingWords =
    headStart === -1 ? [] : lines.slice(headStart, first).flatMap((line) => line.words);

  // Which columns hold figures. Figures are right-aligned, so their heading usually starts to the
  // left of every figure under it.
  const texts = columns.map(() => [] as string[]);
  for (const line of starts) {
    for (const word of line.words) texts[columnOf(word, columns)].push(word.text);
  }
  const numeric = texts.map(
    (list) =>
      list.length > 0 && list.filter((text) => AMOUNT.test(text)).length >= list.length * 0.6,
  );

  /*
    Each heading word goes to the column it sits over. One that sits over no figure at all belongs
    to the figures column to its right, if that is what is there; otherwise it heads a column of
    its own that holds nothing (a cheque number never used), rather than renaming a neighbour.
  */
  const overlap = (word: PositionedWord, column: Column) =>
    Math.min(word.x1, column.x1) - Math.max(word.x0, column.x0);
  const owner = new Map<PositionedWord, Column>();
  const spare: Column[] = [];
  for (const word of headingWords) {
    let best: Column | null = null;
    let bestOverlap = 0;
    for (const column of columns) {
      if (overlap(word, column) > bestOverlap) {
        best = column;
        bestOverlap = overlap(word, column);
      }
    }
    if (!best) {
      const right = columns.findIndex((column) => column.x0 >= word.x1);
      if (right !== -1 && numeric[right]) best = columns[right];
    }
    if (best) owner.set(word, best);
    else spare.push({ x0: word.x0, x1: word.x1 });
  }
  const spareColumns = mergeSpans(spare, Math.max(1.5, height * 0.3));
  const finalColumns = [...columns, ...spareColumns].sort((a, b) => a.x0 - b.x0);

  const header = finalColumns.map(() => '');
  for (const word of headingWords) {
    const column =
      owner.get(word) ??
      spareColumns.find((each) => middle(word) >= each.x0 && middle(word) <= each.x1);
    const index = column ? finalColumns.indexOf(column) : columnOf(word, finalColumns);
    header[index] = header[index] ? `${header[index]} ${word.text}` : word.text;
  }

  const rows: string[][] = [header.map((cell, index) => cell || `Column ${index + 1}`)];
  let current: string[] | null = null;
  let lastBottom = 0;
  let lastPage = -1;

  for (const line of lines) {
    if (starts.has(line)) {
      current = finalColumns.map(() => '');
      rows.push(current);
    } else if (
      !current ||
      line.page !== lastPage ||
      line.top - lastBottom > height * 1.8 ||
      looksLikeHeader(line.words.map((word) => word.text))
    ) {
      // Not part of a transaction: a page header or footer, a heading repeated on a new page,
      // or the summary block after the table. It closes the transaction above it.
      current = null;
      continue;
    }
    for (const word of line.words) {
      const index = columnOf(word, finalColumns);
      current[index] = current[index] ? `${current[index]} ${word.text}` : word.text;
    }
    lastBottom = line.bottom;
    lastPage = line.page;
  }

  return rows.length > 1 ? rows : null;
}

/* ------------------------------------------------------------------ fallback: one line, one row */

interface Cell {
  text: string;
  x0: number;
  x1: number;
}

function toCells(words: PositionedWord[]): Cell[] {
  const height = median(words.map((word) => word.y1 - word.y0));
  const gap = Math.max(3, height * 0.8);
  const cells: Cell[] = [];
  for (const word of words) {
    const last = cells[cells.length - 1];
    if (last && word.x0 - last.x1 < gap) {
      last.text = `${last.text} ${word.text}`;
      last.x1 = Math.max(last.x1, word.x1);
    } else {
      cells.push({ text: word.text, x0: word.x0, x1: word.x1 });
    }
  }
  return cells;
}

/** Each line a row, its cells put under the heading line's columns. */
function linesByHeader(pages: PositionedWord[][]): string[][] {
  const rows: string[][] = [];
  let columns: Cell[] | null = null;
  let headerWritten = false;

  pages.forEach((words, page) => {
    for (const line of groupLines(words, page)) {
      const cells = toCells(line.words);
      if (looksLikeHeader(cells.map((cell) => cell.text))) {
        columns = cells;
        if (!headerWritten) rows.push(cells.map((cell) => cell.text));
        headerWritten = true;
        continue;
      }
      if (!columns) {
        rows.push(cells.map((cell) => cell.text));
        continue;
      }
      const row = columns.map(() => '');
      for (const cell of cells) {
        const index = columnOf(cell, columns);
        row[index] = row[index] ? `${row[index]} ${cell.text}` : cell.text;
      }
      rows.push(row);
    }
  });
  return rows;
}

export function wordsToRows(pages: PositionedWord[][]): string[][] {
  return byDatedLines(pages) ?? linesByHeader(pages);
}
