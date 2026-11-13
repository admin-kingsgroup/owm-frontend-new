/**
 * Reading the first sheet of an Excel `.xlsx` file into rows of text — the same shape `parseCsv`
 * returns, so a caller that reads CSV reads Excel with no other change.
 *
 * Written here rather than taken from a package. The one everybody reaches for is no longer
 * published to npm (the copy that is there is years old and carries known advisories), and what a
 * chart of accounts needs is small: the cells of one sheet, as text. An `.xlsx` file is a zip of XML
 * documents, and the browser can already do both halves — `DecompressionStream` inflates the zip
 * entries, `DOMParser` reads the XML — so this is the glue between them and nothing more.
 *
 * What it deliberately does not do: formulas are read as the value Excel last calculated (which is
 * what a person sees), styles are ignored, and a date cell comes back as Excel's day number rather
 * than a date. None of those occur in a chart of accounts. The old binary `.xls` format is refused
 * with a message saying how to save the file instead.
 */

/** A file this size is far beyond any chart of accounts; past it something is wrong with the file. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** The same guard after inflating, against a small file that expands to an enormous one. */
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;

const SIG_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const SIG_CENTRAL_DIRECTORY = 0x02014b50;
const SIG_LOCAL_HEADER = 0x04034b50;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** The entries of a zip file by name, read from its central directory. */
function readZipDirectory(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // The end record sits in the last 22 bytes plus a comment of up to 64 KB, so it is searched for
  // backwards from the end.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === SIG_END_OF_CENTRAL_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end === -1) throw new Error('That file is not a valid Excel (.xlsx) file.');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names = new TextDecoder();
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== SIG_CENTRAL_DIRECTORY) {
      throw new Error('That Excel file is damaged — open it in Excel and save it again.');
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    entries.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localHeaderOffset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'This browser cannot read Excel files — save the sheet as CSV and upload that.',
    );
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** One zip entry as text, or `null` when the file has no entry of that name. */
async function readEntry(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== SIG_LOCAL_HEADER) {
    throw new Error('That Excel file is damaged — open it in Excel and save it again.');
  }
  // The local header carries its own name and extra lengths, which need not match the directory's.
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);

  let raw: Uint8Array;
  if (entry.method === 0) raw = data;
  else if (entry.method === 8) raw = await inflateRaw(data);
  else throw new Error('That Excel file uses a format this screen cannot read — save it as CSV.');

  if (raw.byteLength > MAX_ENTRY_BYTES) {
    throw new Error('That Excel file is too large to read here.');
  }
  return new TextDecoder().decode(raw);
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('That Excel file is damaged — open it in Excel and save it again.');
  }
  return doc;
}

/** Elements by local name, whatever prefix the writer gave the namespace (`row`, `x:row` …). */
function byName(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

/** The text of a string item: plain `<t>`, or the runs of rich text joined back together. */
function stringItemText(item: Element): string {
  return byName(item, 't')
    .filter((t) => !t.closest('rPh')) // phonetic guides are not part of the text
    .map((t) => t.textContent ?? '')
    .join('');
}

/** "A" → 0, "Z" → 25, "AA" → 26: the column of a cell reference such as "AB12". */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase() ?? '';
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/**
 * A number cell as text a person would recognise.
 *
 * Excel keeps the full binary double, so a cell that shows 0.3 can be stored as
 * 0.30000000000000004. Rounding to fifteen significant digits — the precision Excel itself
 * displays to — gives back the figure that was typed.
 */
function numberText(raw: string): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  return String(Number(value.toPrecision(15)));
}

/** Where the first sheet lives: workbook order, resolved through the workbook's relationships. */
async function firstSheetPath(bytes: Uint8Array, entries: Map<string, ZipEntry>): Promise<string> {
  const fallback = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name))
    .sort()[0];

  const workbook = await readEntry(bytes, entries, 'xl/workbook.xml');
  const rels = await readEntry(bytes, entries, 'xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) {
    if (fallback) return fallback;
    throw new Error('That file has no sheet in it.');
  }

  const sheet = byName(parseXml(workbook), 'sheet')[0];
  const relationId =
    sheet?.getAttribute('r:id') ??
    sheet?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    );
  const target = byName(parseXml(rels), 'Relationship')
    .find((rel) => rel.getAttribute('Id') === relationId)
    ?.getAttribute('Target');

  if (!target) {
    if (fallback) return fallback;
    throw new Error('That file has no sheet in it.');
  }
  // Targets are relative to xl/ unless they start at the root.
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

/**
 * The cells of the first sheet, as rows of text. Empty cells inside a row come back as `''` so
 * every column stays where it is; rows with nothing in them at all are dropped, as a blank line is
 * in a CSV.
 */
export async function readXlsxRows(file: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(file);
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error('That file is too large to import here.');
  }
  // The old binary format starts with an OLE header rather than a zip one.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new Error(
      'That is an old-style Excel file (.xls). Open it in Excel and save it as .xlsx or CSV.',
    );
  }

  const entries = readZipDirectory(bytes);
  if (entries.has('EncryptionInfo')) {
    throw new Error('That Excel file is password-protected — remove the password and try again.');
  }

  const sharedXml = await readEntry(bytes, entries, 'xl/sharedStrings.xml');
  const shared = sharedXml ? byName(parseXml(sharedXml), 'si').map(stringItemText) : [];

  const sheetXml = await readEntry(bytes, entries, await firstSheetPath(bytes, entries));
  if (!sheetXml) throw new Error('That file has no sheet in it.');

  const rows: string[][] = [];
  let nextRow = 0;

  for (const rowElement of byName(parseXml(sheetXml), 'row')) {
    // `r` is 1-based and may skip blank rows; without it, rows simply follow one another.
    const r = Number(rowElement.getAttribute('r'));
    const rowIndex = Number.isInteger(r) && r > 0 ? r - 1 : nextRow;
    nextRow = rowIndex + 1;

    const cells: string[] = [];
    let nextColumn = 0;

    for (const cell of byName(rowElement, 'c')) {
      const reference = cell.getAttribute('r');
      const column = reference ? columnIndex(reference) : nextColumn;
      nextColumn = column + 1;

      const type = cell.getAttribute('t');
      const v = byName(cell, 'v')[0]?.textContent ?? '';
      let text: string;

      if (type === 's') text = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') text = byName(cell, 'is').map(stringItemText).join('');
      else if (type === 'b') text = v === '1' ? 'true' : 'false';
      else if (type === 'str' || type === 'e') text = v;
      else text = v === '' ? '' : numberText(v);

      while (cells.length < column) cells.push('');
      cells[column] = text;
    }

    if (cells.some((cell) => cell.trim() !== '')) rows[rowIndex] = cells;
  }

  // Rows that were skipped in the sheet leave holes; they are blank lines and are dropped.
  return rows.filter((row): row is string[] => Array.isArray(row));
}

/** Whether a chosen file is an Excel workbook rather than CSV, by its name or its declared type. */
export function isXlsxFile(file: File): boolean {
  return (
    /\.xlsx$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

/** Whether a chosen file is the old binary Excel format, which is refused with advice. */
export function isLegacyXlsFile(file: File): boolean {
  return /\.xls$/i.test(file.name) || file.type === 'application/vnd.ms-excel';
}
