import { useRef } from 'react';
import type { ReactNode, TableHTMLAttributes } from 'react';

import { cn } from '@/shared/lib';
import { useStackedTables } from '@/shared/hooks';

import styles from './Table.module.css';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /**
   * Whether the grid draws its own surface.
   *
   * `card` is a grid standing on its own — the vouchers register, reported errors, the companies
   * list. `plain` is a grid already inside a Panel, which has drawn the border and the background
   * once already; a second one inside it reads as a box in a box.
   */
  surface?: 'card' | 'plain';
  /**
   * `tight` is for a grid nested inside another record's card — the parties panel, which the token
   * file names as the one deliberate exception to the shared density.
   */
  density?: 'default' | 'tight';
  /**
   * Pins the column headings and the totals while the body scrolls. For statements long enough to
   * need it; on a short grid it costs a stacking context and buys nothing.
   */
  sticky?: boolean;
  /**
   * Alternating row tint. On by default — a wide row of figures is read across, and the stripe is
   * what stops the eye dropping a line. Turn it off for a short summary, where it is noise.
   */
  zebra?: boolean;
  /**
   * Rows become cards below 48rem — see the `data-stack` block in globals.css.
   *
   * The field names each cell announces are copied from the table's own `<thead>`, so nothing here
   * needs writing by hand and the two cannot disagree. Pages used to write `data-label` on every
   * cell themselves, which is a second copy of every column name kept somewhere it drifts the
   * first time a column is added or moved.
   *
   * For record lists, where a row is one thing with a handful of named fields. A financial
   * statement is genuinely two columns of figures and stays a table: reading a balance sheet as
   * cards is worse, not better, so those scroll sideways instead.
   */
  stack?: boolean;
  /**
   * Goes on the scroller, which is this component's root element — so a page can make its grid
   * fill the pane (`flex: 1; min-height: 0`) the way the register does. Rules meant for the table
   * itself belong in `tableClassName`.
   */
  className?: string;
  tableClassName?: string;
  children: ReactNode;
}

/**
 * The product's grid.
 *
 * Always inside its own scroller, which is what keeps a wide statement from sliding the whole
 * application sideways on a phone. Cells are marked by attribute rather than by imported class —
 * `<td data-num>` for a figure, `data-mono` for a code, `data-muted` for a quiet one — matching
 * the `data-stack` / `data-label` idiom globals.css already uses.
 */
export function Table({
  surface = 'card',
  density = 'default',
  sticky = false,
  zebra = true,
  stack = false,
  className,
  tableClassName,
  children,
  ...props
}: TableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
    Copies the column headings onto the body cells, for the stacked layout below 48rem. Called
    unconditionally — it looks for `table[data-stack]` and does nothing when there is none, so a
    grid that does not stack pays one querySelectorAll that finds nothing.
  */
  useStackedTables(scrollRef);

  return (
    <div
      ref={scrollRef}
      className={cn(styles.scroll, surface === 'card' && styles.card, className)}
    >
      <table
        className={cn(
          styles.table,
          zebra && styles.zebra,
          sticky && styles.sticky,
          density === 'tight' && styles.tight,
          tableClassName,
        )}
        {...(stack ? { 'data-stack': true } : {})}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
