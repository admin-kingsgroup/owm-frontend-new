import { describe, it, expect } from 'vitest';

import { columnsFor, distribute, groupItems } from './menu-layout';
import type { MenuGroup } from './menu-layout';
import type { MenuItem } from './menus';

/**
 * How a menu is laid out.
 *
 * Worth testing here rather than through the bar, because it is arithmetic and because the bar
 * itself only renders under jsdom: the fault this file was written after — a three-column menu
 * walking off the end of its own column array — threw the moment Reports was opened and no test
 * in the product would have seen it.
 */

const item = (label: string, section?: string): MenuItem => ({
  label,
  to: `/${label.toLowerCase().replace(/\W+/g, '-')}`,
  ...(section ? { section } : {}),
});

/** The Reports menu, which is the shape everything here exists for: twenty-one items in six groups. */
const REPORTS: MenuItem[] = [
  item('Balance Sheet'),
  item('Profit & Loss'),
  item('Trial Balance'),
  item('Cash Flow'),
  item('Receipts & Payments'),
  item('Day Book', 'Books & registers'),
  item('Sales Register', 'Registers'),
  item('Purchase Register'),
  item('Payment Register'),
  item('Receipt Register'),
  item('Journal Register'),
  item('Ledger'),
  item('Cash Book'),
  item('Bank Book'),
  item('Group Summary'),
  item('Monthly Summary'),
  item('Bank Reconciliation', 'Reconcile'),
  item('Statement of Account', 'Outstanding'),
  item('Receivables'),
  item('Payables'),
  item('Forex Gain/Loss', 'Currency'),
];

/** Transactions: a bare run of one, then everything the company can raise. */
const TRANSACTIONS: MenuItem[] = [
  item('Vouchers'),
  item('Contra', 'Create'),
  item('Payment'),
  item('Receipt'),
  item('Journal'),
  item('Income'),
  item('Expense'),
];

describe('groupItems', () => {
  it('opens an unnamed group for the run before any heading', () => {
    const [first] = groupItems(TRANSACTIONS);
    expect(first.name).toBeNull();
    expect(first.items.map((entry) => entry.label)).toEqual(['Vouchers']);
  });

  it('keeps every item under the heading that introduced it', () => {
    const groups = groupItems(REPORTS);
    expect(groups.map((group) => group.name)).toEqual([
      null,
      'Books & registers',
      'Registers',
      'Reconcile',
      'Outstanding',
      'Currency',
    ]);
    // The run continues past the item that carried the marker until the next one.
    expect(groups[2].items).toHaveLength(10);
  });

  it('loses nothing', () => {
    const groups = groupItems(REPORTS);
    const kept = groups.flatMap((group) => group.items);
    expect(kept).toHaveLength(REPORTS.length);
  });
});

describe('columnsFor', () => {
  it('leaves a short menu as one column', () => {
    // Seven items across two groups: a second column would not make it shorter, only wider.
    expect(columnsFor(groupItems(TRANSACTIONS))).toBe(1);
  });

  it('gives a long menu three', () => {
    expect(columnsFor(groupItems(REPORTS))).toBe(3);
  });

  it('never asks for more columns than there are groups to fill them', () => {
    // Twenty items in one group is still one column — a card cannot be split between two.
    const oneBigGroup = groupItems(
      Array.from({ length: 20 }, (_, at) => item(`Report ${at}`, at === 0 ? 'Everything' : undefined)),
    );
    expect(oneBigGroup).toHaveLength(1);
    expect(columnsFor(oneBigGroup)).toBe(1);
  });
});

describe('distribute', () => {
  const labels = (columns: MenuGroup[][]) =>
    columns.map((column) => column.map((group) => group.name ?? '·'));

  it('places every group exactly once', () => {
    const groups = groupItems(REPORTS);
    const columns = distribute(groups, 3);
    expect(columns.flat()).toHaveLength(groups.length);
    expect(new Set(columns.flat())).toEqual(new Set(groups));
  });

  it('fills the last column rather than running off the end of the array', () => {
    // The fault this file was written for: six groups into three columns walked to index 3.
    const columns = distribute(groupItems(REPORTS), 3);
    expect(columns).toHaveLength(3);
    expect(columns.every((column) => column.length > 0)).toBe(true);
  });

  it('leaves no column empty, for every shape a menu takes', () => {
    for (const items of [REPORTS, TRANSACTIONS]) {
      const groups = groupItems(items);
      for (let columns = 1; columns <= groups.length; columns++) {
        const laid = distribute(groups, columns);
        expect(laid, `${columns} columns`).toHaveLength(columns);
        expect(
          laid.every((column) => column.length > 0),
          `${columns} columns left one empty: ${JSON.stringify(labels(laid))}`,
        ).toBe(true);
      }
    }
  });

  it('keeps the declared order, reading down each column then across', () => {
    const groups = groupItems(REPORTS);
    const flattened = distribute(groups, 3).flat();
    expect(flattened).toEqual(groups);
  });

  it('balances rather than filling the first column until it overflows', () => {
    const groups = groupItems(REPORTS);
    const heights = distribute(groups, 3).map((column) =>
      column.reduce((sum, group) => sum + group.items.length + (group.name ? 1 : 0), 0),
    );

    // Left to fill greedily, the ten-item Registers group lands in the first column behind five
    // more and the panel comes out badly lopsided. Nothing should carry over half the total.
    const total = heights.reduce((sum, height) => sum + height, 0);
    expect(Math.max(...heights)).toBeLessThan(total / 2);
  });

  it('survives a menu with nothing in it', () => {
    expect(distribute([], 1)).toEqual([[]]);
  });
});
