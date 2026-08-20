import { describe, it, expect } from 'vitest';

import { toCsv, flattenNodes } from './export-csv';
import type { ReportNode } from '@/entities/report';

const node = (patch: Partial<ReportNode>): ReportNode => ({
  kind: 'group',
  id: '000000000000000000000001',
  code: 'CODE',
  name: 'Name',
  debit: '0.00',
  credit: '0.00',
  balance: '0.00',
  balanceSide: 'DEBIT',
  ...patch,
});

describe('toCsv', () => {
  it('quotes every field so a comma cannot split a cell', () => {
    expect(toCsv(['Name'], [['Smith, Bob & Co']])).toBe('"Name"\r\n"Smith, Bob & Co"');
  });

  it('doubles inner quotes rather than ending the field early', () => {
    expect(toCsv(['Name'], [['Smith "Bob" Ltd']])).toBe('"Name"\r\n"Smith ""Bob"" Ltd"');
  });

  it('writes amounts through untouched', () => {
    // They are decimal strings from the server; reparsing them is how a total stops being exact.
    expect(toCsv(['Amount'], [['1680750.00']])).toContain('"1680750.00"');
  });

  it('keeps a newline inside a quoted field', () => {
    expect(toCsv(['Narration'], [['line one\nline two']])).toBe(
      '"Narration"\r\n"line one\nline two"',
    );
  });

  it('separates rows with CRLF, which is what a spreadsheet expects', () => {
    expect(toCsv(['A'], [['1'], ['2']])).toBe('"A"\r\n"1"\r\n"2"');
  });

  it('renders an empty value as an empty field rather than the word undefined', () => {
    expect(toCsv(['A', 'B'], [['x', undefined as unknown as string]])).toBe('"A","B"\r\n"x",""');
  });
});

describe('flattenNodes', () => {
  it('indents each level so the nesting survives into a flat file', () => {
    const rows = flattenNodes([
      node({
        code: 'CURRENT_ASSETS',
        name: 'Current Assets',
        children: [node({ kind: 'ledger', code: 'CASH', name: 'Cash', balance: '600.00' })],
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe('Current Assets');
    expect(rows[1][0]).toBe('    Cash');
    expect(rows[1][2]).toBe('ledger');
  });

  it('walks arbitrarily deep', () => {
    const rows = flattenNodes([
      node({
        name: 'A',
        children: [node({ name: 'B', children: [node({ kind: 'ledger', name: 'C' })] })],
      }),
    ]);

    expect(rows.map((row) => row[0])).toEqual(['A', '    B', '        C']);
  });

  it('returns nothing for an empty tree', () => {
    expect(flattenNodes([])).toEqual([]);
  });
});
