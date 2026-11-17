import type { StatementFormat } from '@/entities/bank-statement';
import { isLegacyXlsFile, isXlsxFile, parseCsv, readXlsxRows } from '@/shared/lib';

import { isCamtXml, parseCamt } from './camt';
import { readPdfWords, type Progress } from './pdf';
import type { ReadLines } from './statement-table';
import { wordsToRows } from './words-to-rows';

/**
 * What a file turned out to be.
 *
 * - `table` — rows of text whose columns still need naming: CSV, Excel, an HTML "Excel" file,
 *   or a PDF rebuilt into rows.
 * - `lines` — already statement lines, because the format names every field itself: camt.053 XML.
 */
export type ReadStatement =
  | { kind: 'table'; format: StatementFormat; rows: string[][] }
  | ({ kind: 'lines'; format: StatementFormat } & ReadLines);

const MAX_BYTES = 25 * 1024 * 1024;

const extensionOf = (file: File) => file.name.toLowerCase().split('.').pop() ?? '';

/**
 * Splits delimited text. A comma file goes through the shared CSV reader; banks also export with
 * tabs, semicolons or pipes, which are split here, quotes respected.
 */
export function parseDelimited(text: string): string[][] {
  const sample = text.split(/\r?\n/).slice(0, 30).join('\n');
  const count = (character: string) => sample.split(character).length - 1;
  const candidates: Array<[string, number]> = [
    [',', count(',')],
    ['\t', count('\t')],
    [';', count(';')],
    ['|', count('|')],
  ];
  const [delimiter] = candidates.sort((a, b) => b[1] - a[1])[0];
  if (delimiter === ',') return parseCsv(text);

  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const cells: string[] = [];
      let field = '';
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
          if (quoted && line[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (character === delimiter && !quoted) {
          cells.push(field);
          field = '';
        } else {
          field += character;
        }
      }
      cells.push(field);
      return cells;
    });
}

/**
 * Many banks' "Excel" download is really a web page holding a table, named `.xls`. Its rows are
 * read straight out of the HTML.
 */
export function parseHtmlTable(text: string): string[][] {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const rows: string[][] = [];
  for (const row of Array.from(doc.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
      (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

export async function readStatementFile(
  file: File,
  options: { password?: string; progress: Progress },
): Promise<ReadStatement> {
  if (file.size > MAX_BYTES) {
    throw new Error(
      'That file is too large for a bank statement. Upload one month or quarter at a time.',
    );
  }
  const extension = extensionOf(file);

  if (extension === 'pdf' || file.type === 'application/pdf') {
    const { pages, ocr } = await readPdfWords(
      await file.arrayBuffer(),
      options.password,
      options.progress,
    );
    const rows = wordsToRows(pages);
    if (rows.length === 0) throw new Error('No text could be read from that PDF.');
    return { kind: 'table', format: ocr ? 'PDF_OCR' : 'PDF', rows };
  }

  if (extension === 'xml' || file.type.includes('xml')) {
    options.progress('Reading the XML statement…');
    const text = await file.text();
    if (!isCamtXml(text)) {
      throw new Error(
        'That XML file is not a bank statement in the ISO 20022 camt.053 format. Ask the bank for camt.053, or download the statement as CSV, Excel or PDF instead.',
      );
    }
    return { kind: 'lines', format: 'XML', ...parseCamt(text) };
  }

  if (isXlsxFile(file)) {
    options.progress('Reading the Excel sheet…');
    return { kind: 'table', format: 'XLSX', rows: await readXlsxRows(await file.arrayBuffer()) };
  }

  // A file named .xls may be a real old Excel file, or a web page in disguise.
  const head = new TextDecoder().decode((await file.slice(0, 2048).arrayBuffer()) as ArrayBuffer);
  if (/<\s*(html|table|!doctype)/i.test(head)) {
    options.progress('Reading the table…');
    return { kind: 'table', format: 'XLSX', rows: parseHtmlTable(await file.text()) };
  }
  if (isLegacyXlsFile(file)) {
    throw new Error(
      'That is an old-style Excel file (.xls). Open it in Excel and save it as .xlsx or CSV, or download the statement as CSV or PDF.',
    );
  }

  if (['csv', 'txt', 'tsv', ''].includes(extension) || file.type.startsWith('text/')) {
    options.progress('Reading the file…');
    return { kind: 'table', format: 'CSV', rows: parseDelimited(await file.text()) };
  }

  throw new Error('That kind of file cannot be read. Use CSV, Excel (.xlsx), camt.053 XML or PDF.');
}
