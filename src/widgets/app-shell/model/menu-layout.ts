import type { MenuItem } from './menus';

export interface MenuGroup {
  /** The heading, or null for the run of items before any heading. */
  name: string | null;
  items: MenuItem[];
}

/**
 * The items of a menu, gathered under the headings that introduce them.
 *
 * `section` marks where a group *starts* — it sits on the first item of the run, and everything
 * after it belongs to that heading until the next one. The menu used to render that flat, printing
 * the heading inline and letting the items fall where they may, which is why a menu of twenty was
 * one column seven hundred pixels tall.
 *
 * A menu almost always opens with items carrying no section at all — Portfolio and Vouchers, ahead
 * of Create — so the first group is usually unnamed. That one is drawn without a card: a box with
 * an empty heading is worse than no box.
 */
export function groupItems(items: MenuItem[]): MenuGroup[] {
  const groups: MenuGroup[] = [];

  for (const item of items) {
    if (item.section || groups.length === 0) {
      groups.push({ name: item.section ?? null, items: [item] });
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }

  return groups;
}

/**
 * How much room a group takes, in lines. Its heading counts as one, so a card holding a single
 * item is not weighed as though it were a bare row.
 */
const weigh = (group: MenuGroup): number => group.items.length + (group.name === null ? 0 : 1);

/**
 * How many columns the panel runs to.
 *
 * From how much is in the menu, not from how many groups it happens to be divided into. Counting
 * groups alone gave Transactions two columns for seven items — one group held a single link, so
 * the panel was 32rem wide with most of it standing empty.
 *
 * A second column has to earn itself by making the menu shorter, and seven items are not long
 * enough to be worth reading across. Twenty are: Reports is the menu this exists for.
 *
 * Never more columns than there are groups, since a group is a card and cannot be split down the
 * middle of itself — three columns and two groups is one empty column by arithmetic.
 */
export function columnsFor(groups: MenuGroup[]): 1 | 2 | 3 {
  const items = groups.reduce((count, group) => count + group.items.length, 0);
  const wanted = items <= 9 ? 1 : items <= 16 ? 2 : 3;
  return Math.min(wanted, Math.max(groups.length, 1)) as 1 | 2 | 3;
}

/**
 * Which groups go in which column.
 *
 * Decided here rather than left to CSS multi-column. `column-count` balances by height and cannot
 * break a card, which it handles badly: Transactions has a one-line group and a six-line one, and
 * the browser put both in the first column and left the second standing empty inside a panel sized
 * for two. A menu that draws an empty column is worse than one that never offered a second.
 *
 * Filled in order, so reading down a column and then across is the order the menu was declared in
 * — which is also the order the arrow keys walk, since they follow the DOM.
 *
 * Two rules decide when to start the next column, and both are needed:
 *
 *   - a column moves on once taking the next group would carry it further past its share than
 *     leaving it would fall short — that is what `weigh(group) / 2` is measuring, and without it a
 *     ten-line group lands wherever it happens to fall and the columns come out lopsided;
 *   - and it moves on regardless when exactly enough groups remain to give every remaining column
 *     one, so the last columns cannot starve.
 *
 * Both are held back while only one column remains. Without that guard the second rule ran off the
 * end of the array on the last group of a three-column menu — Reports threw the moment it opened.
 */
export function distribute(groups: MenuGroup[], columns: number): MenuGroup[][] {
  const into: MenuGroup[][] = Array.from({ length: Math.max(columns, 1) }, () => []);
  const target = groups.reduce((sum, group) => sum + weigh(group), 0) / into.length;

  let column = 0;
  let filled = 0;

  for (const [index, group] of groups.entries()) {
    const columnsLeft = into.length - column;
    const groupsLeft = groups.length - index;

    /* Never past the last column, whatever either rule below would prefer. */
    if (columnsLeft > 1) {
      const mustMoveOn = groupsLeft <= columnsLeft && into[column].length > 0;
      const shouldMoveOn =
        filled > 0 && filled + weigh(group) / 2 >= target && groupsLeft > columnsLeft - 1;

      if (mustMoveOn || shouldMoveOn) {
        column += 1;
        filled = 0;
      }
    }

    into[column].push(group);
    filled += weigh(group);
  }

  return into;
}
