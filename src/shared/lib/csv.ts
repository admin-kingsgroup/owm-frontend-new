/**
 * Reading and writing CSV, which is how a chart of accounts arrives from and leaves for a
 * spreadsheet.
 *
 * It lives in `shared` because two layers want it now: the reports export statements, and the
 * company screen exchanges masters. The escaping is the part that silently corrupts a file, so it
 * is one implementation with tests rather than one per caller.
 */

/**
 * Serialises a table to CSV text.
 *
 * Amounts are written exactly as they were received — they are decimal strings, and letting a
 * spreadsheet reparse a rounded number is how a trial balance stops totalling zero. Every field is
 * quoted and inner quotes doubled, so a ledger named `Smith "Bob" & Co, Ltd` survives the trip.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

/**
 * Reads CSV text back into rows, honouring quotes.
 *
 * Written as a character walk rather than a split on commas, because a split cannot tell a comma
 * inside `"Smith, Bob"` from one between fields — and a chart of accounts is full of names with
 * commas in them. Newlines inside a quoted field are kept, blank trailing lines dropped, and a
 * leading byte-order mark removed: a file saved by Excel starts with one and would otherwise turn
 * the first header into something that matches nothing.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let started = false;

  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  const endField = () => {
    row.push(field);
    field = '';
    started = false;
  };

  const endRow = () => {
    endField();
    // A file ends with a newline, which would otherwise add a row of one empty field.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (source[index + 1] === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (character === '"' && !started) {
      quoted = true;
      started = true;
    } else if (character === ',') {
      endField();
    } else if (character === '\n') {
      endRow();
    } else {
      field += character;
      started = true;
    }
  }

  // Whatever is left when the text runs out is the last row, unless the file ended on a newline.
  if (field !== '' || row.length > 0) endRow();

  return rows;
}

/** Hands the serialised table to the browser as a download. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = toCsv(headers, rows);

  // The BOM is what makes Excel read it as UTF-8 rather than the local codepage, which otherwise
  // mangles a currency symbol or an accented ledger name.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
