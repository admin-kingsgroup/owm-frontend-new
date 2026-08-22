import { describe, it, expect } from 'vitest';

import { parseCsv, toCsv } from './csv';

/**
 * A chart of accounts goes out to a spreadsheet and comes back, and the escaping is the part that
 * loses data without saying so. These are the shapes a real file arrives in: names with commas and
 * quotes in them, a byte-order mark from Excel, Windows line endings, and a trailing newline.
 */
describe('csv', () => {
  it('survives a round trip through a spreadsheet', () => {
    const headers = ['code', 'name'];
    const rows = [
      ['SMITH', 'Smith "Bob" & Co, Ltd'],
      ['NEWLINE', 'Two\nlines'],
      ['EMPTY', ''],
    ];

    expect(parseCsv(toCsv(headers, rows))).toEqual([headers, ...rows]);
  });

  it('reads a comma inside a quoted name as part of the name', () => {
    expect(parseCsv('code,name\r\nA,"Smith, Bob"')).toEqual([
      ['code', 'name'],
      ['A', 'Smith, Bob'],
    ]);
  });

  it('reads a doubled quote as one quote', () => {
    expect(parseCsv('name\r\n"Say ""hello"""')).toEqual([['name'], ['Say "hello"']]);
  });

  it('drops the byte-order mark Excel writes, so the first column still matches', () => {
    const [header] = parseCsv('﻿code,name\r\nA,B');
    expect(header[0]).toBe('code');
  });

  it('does not invent a row from the newline a file ends with', () => {
    expect(parseCsv('code\r\nA\r\n')).toEqual([['code'], ['A']]);
  });

  it('keeps an empty trailing field rather than dropping the column', () => {
    expect(parseCsv('a,b,c\r\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });

  it('has nothing to say about an empty file', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('writes every field quoted, so a comma can never split a column', () => {
    expect(toCsv(['a'], [['x,y']])).toBe('"a"\r\n"x,y"');
  });
});
