// @vitest-environment jsdom
import { useRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { useStackedTables } from './use-stacked-tables';

/**
 * Below 48rem these tables become a list of cards, and each cell announces its own column from
 * `data-label`. Getting that mapping wrong is not a layout blemish: it prints a figure under the
 * name of the column beside the one it is actually in, which on a statement is a wrong number.
 *
 * The e2e suite proves a stacked cell has *a* label. This proves it has the right one.
 */
function Statement() {
  const ref = useRef<HTMLDivElement>(null);
  useStackedTables(ref);

  return (
    <div ref={ref}>
      <table data-stack>
        <thead>
          <tr>
            <th>Particulars</th>
            <th>Debit</th>
            <th>Credit</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cash</td>
            <td>100.00</td>
            <td>0.00</td>
            <td>
              <button type="button">Open</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td>100.00</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const labels = (row: HTMLTableRowElement) =>
  Array.from(row.children).map((cell) => cell.getAttribute('data-label'));

describe('useStackedTables', () => {
  afterEach(cleanup);

  it('labels each body cell with its own column', () => {
    const { container } = render(<Statement />);
    const row = container.querySelector('tbody tr') as HTMLTableRowElement;

    expect(labels(row).slice(0, 3)).toEqual(['Particulars', 'Debit', 'Credit']);
  });

  it('counts a spanned cell as the columns it covers, not as one', () => {
    /*
      The regression this exists for. The figure is the second cell in the row, so labelling by
      index would call it "Debit" — but the cell before it spans Particulars and Debit together,
      which puts the figure in Credit. A total announced as a debit is worse than an unlabelled one.
    */
    const { container } = render(<Statement />);
    const total = container.querySelector('tfoot tr') as HTMLTableRowElement;

    expect(labels(total)[1]).toBe('Credit');
  });

  it('leaves a spanned cell unlabelled, since it belongs to no single column', () => {
    const { container } = render(<Statement />);
    const total = container.querySelector('tfoot tr') as HTMLTableRowElement;

    expect(labels(total)[0]).toBeNull();
  });

  it('leaves a cell unlabelled when its column has no heading', () => {
    // The actions at the end of a row. The stacked rule gives those the full width instead.
    const { container } = render(<Statement />);
    const row = container.querySelector('tbody tr') as HTMLTableRowElement;

    expect(labels(row)[3]).toBeNull();
  });

  it('does nothing to a table that did not ask to be stacked', () => {
    function Plain() {
      const ref = useRef<HTMLDivElement>(null);
      useStackedTables(ref);
      return (
        <div ref={ref}>
          <table>
            <thead>
              <tr>
                <th>Particulars</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cash</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    const { container } = render(<Plain />);
    expect(container.querySelector('tbody td')?.getAttribute('data-label')).toBeNull();
  });
});
