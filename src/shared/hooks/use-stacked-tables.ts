import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Copies each `table[data-stack]`'s column headings onto its own cells.
 *
 * Below 48rem those tables become a list of cards: the header row is hidden, because a card
 * carries its own labels, and each cell announces itself from `data-label`. Writing that attribute
 * by hand means repeating every column name down in the body, where it drifts the first time a
 * column is added or moved — and a statement whose figures are labelled with the wrong column is
 * worse than one that is merely hard to read.
 *
 * Reading them from the `<thead>` the table already has means the two cannot disagree. Applied to
 * a container rather than per table, since a screen usually holds several.
 *
 * No dependency array: rows change with filters, paging and the period, and the labels have to
 * follow. It is a handful of attribute writes over rows already in the DOM.
 */
export function useStackedTables(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    for (const table of container.querySelectorAll('table[data-stack]')) {
      const headings = Array.from(table.querySelectorAll('thead th')).map(
        (heading) => heading.textContent?.trim() ?? '',
      );

      for (const row of table.querySelectorAll('tbody tr, tfoot tr')) {
        // Position, not index: a cell spanning columns consumes several of them, so everything
        // after a `colSpan` in the same row would otherwise be labelled with the wrong column —
        // a totals figure announced as the column before the one it is actually in.
        let column = 0;

        for (const cell of Array.from(row.children)) {
          const span = (cell as HTMLTableCellElement).colSpan || 1;
          const heading = span === 1 ? headings[column] : '';

          // A cell spanning columns belongs to no single one, and a column with no heading — the
          // actions at the end of a row, a column of flags — has nothing to announce. The stacked
          // rule gives both the full width instead of a label and a value.
          if (heading) {
            cell.setAttribute('data-label', heading);
          } else {
            cell.removeAttribute('data-label');
          }

          column += span;
        }
      }
    }
  });
}
