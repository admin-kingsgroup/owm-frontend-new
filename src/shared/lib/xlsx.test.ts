// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { isLegacyXlsFile, isXlsxFile, readXlsxRows } from './xlsx';

/**
 * A zip of the given files, stored rather than compressed — which is a valid zip, and keeps these
 * tests about reading the workbook rather than about inflating. The reader does not check CRCs, so
 * they are left as zero.
 */
function zip(files: Record<string, string>): ArrayBuffer {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out.buffer;
}

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function workbook(sheetXml: string, sharedStrings?: string[], sheetPath = 'worksheets/sheet1.xml') {
  const files: Record<string, string> = {
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets><sheet name="Ledgers" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="${sheetPath}"/></Relationships>`,
    [`xl/${sheetPath}`]: `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${sheetXml}</sheetData></worksheet>`,
  };
  if (sharedStrings) {
    files['xl/sharedStrings.xml'] =
      `<?xml version="1.0"?><sst xmlns="${NS}">` +
      sharedStrings.map((text) => `<si><t>${text}</t></si>`).join('') +
      '</sst>';
  }
  return zip(files);
}

describe('readXlsxRows', () => {
  it('reads shared strings, numbers, inline strings and booleans as text', async () => {
    const rows = await readXlsxRows(
      workbook(
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>250000</v></c><c r="C2" t="b"><v>1</v></c></row>' +
          '<row r="3"><c r="A3" t="inlineStr"><is><t>SHAH</t></is></c><c r="B3"><v>15000.5</v></c><c r="C3" t="b"><v>0</v></c></row>',
        ['code', 'openingBalance', 'maintainBillwise', 'HDFC'],
      ),
    );

    expect(rows).toEqual([
      ['code', 'openingBalance', 'maintainBillwise'],
      ['HDFC', '250000', 'true'],
      ['SHAH', '15000.5', 'false'],
    ]);
  });

  it('keeps every value in its own column when cells in between are empty', async () => {
    const rows = await readXlsxRows(
      workbook(
        '<row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="C1"><v>3</v></c></row>',
      ),
    );
    expect(rows).toEqual([['a', '', '3']]);
  });

  it('drops blank rows, as a blank line is dropped from a CSV', async () => {
    const rows = await readXlsxRows(
      workbook('<row r="1"><c r="A1"><v>1</v></c></row><row r="4"><c r="A4"><v>4</v></c></row>'),
    );
    expect(rows).toEqual([['1'], ['4']]);
  });

  /* Excel stores the binary double; a cell showing 0.3 can hold 0.30000000000000004. */
  it('gives back the figure that was typed, not the floating-point noise behind it', async () => {
    const rows = await readXlsxRows(
      workbook('<row r="1"><c r="A1"><v>0.30000000000000004</v></c></row>'),
    );
    expect(rows).toEqual([['0.3']]);
  });

  it('finds the first sheet through the workbook, whatever its file is called', async () => {
    const rows = await readXlsxRows(
      workbook('<row r="1"><c r="A1"><v>7</v></c></row>', undefined, 'worksheets/data.xml'),
    );
    expect(rows).toEqual([['7']]);
  });

  it('joins the runs of a rich-text cell back into one string', async () => {
    const buffer = zip({
      'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets><sheet r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      'xl/sharedStrings.xml': `<sst xmlns="${NS}"><si><r><t>Ramesh </t></r><r><t>Traders</t></r></si></sst>`,
      'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`,
    });
    expect(await readXlsxRows(buffer)).toEqual([['Ramesh Traders']]);
  });

  it('refuses the old .xls format with advice on what to do', async () => {
    const legacy = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]).buffer;
    await expect(readXlsxRows(legacy)).rejects.toThrow(/save it as \.xlsx or CSV/);
  });

  it('refuses a file that is not a workbook at all', async () => {
    const text = new TextEncoder().encode('code,name\nA,B\n').buffer;
    await expect(readXlsxRows(text)).rejects.toThrow(/not a valid Excel/);
  });
});

describe('file type checks', () => {
  it('tells an .xlsx workbook from CSV and from the old .xls', () => {
    expect(isXlsxFile(new File([''], 'chart.XLSX'))).toBe(true);
    expect(isXlsxFile(new File([''], 'chart.csv', { type: 'text/csv' }))).toBe(false);
    expect(isLegacyXlsFile(new File([''], 'chart.xls'))).toBe(true);
    expect(isLegacyXlsFile(new File([''], 'chart.xlsx'))).toBe(false);
  });
});
