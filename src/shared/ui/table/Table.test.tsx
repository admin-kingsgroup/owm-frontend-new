// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';

import { Table } from './Table';

/**
 * The grid that replaced seven of them.
 *
 * What is worth pinning here is the behaviour pages used to write for themselves and now trust
 * this to do — the stacked field names above all, because that is the one a page cannot see going
 * wrong: a mislabelled cell on a phone still renders, it just says the wrong thing.
 */
describe('Table', () => {
  afterEach(cleanup);

  function Grid() {
    return (
      <Table stack>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th data-num>Balance</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-mono>BNK001</td>
            <td>HDFC Current</td>
            <td data-num>7,42,265.00</td>
            <td>
              <button type="button">Edit</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total
            </th>
            <td data-num>7,42,265.00</td>
            <td />
          </tr>
        </tfoot>
      </Table>
    );
  }

  it('copies the column headings onto the body cells', () => {
    render(<Grid />);

    const cells = screen.getAllByRole('cell');
    expect(cells[0].getAttribute('data-label')).toBe('Code');
    expect(cells[1].getAttribute('data-label')).toBe('Name');
    expect(cells[2].getAttribute('data-label')).toBe('Balance');
  });

  it('leaves a cell with no heading unlabelled, so it spans the card', () => {
    render(<Grid />);

    // The actions column has an empty <th>: there is nothing to announce, and a label of "" would
    // draw an empty bold word above the button.
    const cells = screen.getAllByRole('cell');
    expect(cells[3].hasAttribute('data-label')).toBe(false);
  });

  it('does not label a cell that spans columns', () => {
    render(<Grid />);

    // The footing's "Total" covers Code and Name. Labelled from position it would claim to be
    // "Code", and every figure after it in the row would take the heading of the column before.
    const total = screen.getByRole('rowheader', { name: 'Total' });
    expect(total.hasAttribute('data-label')).toBe(false);

    // The figure beside it still gets its own column's name rather than the one to its left.
    const footCells = screen.getAllByRole('cell');
    expect(footCells[footCells.length - 2].getAttribute('data-label')).toBe('Balance');
  });

  it('writes no stacking attribute unless the grid opts in', () => {
    const { container } = render(
      <Table>
        <tbody>
          <tr>
            <td>Only</td>
          </tr>
        </tbody>
      </Table>,
    );

    expect(container.querySelector('table')?.hasAttribute('data-stack')).toBe(false);
    expect(container.querySelector('td')?.hasAttribute('data-label')).toBe(false);
  });

  it('puts the caller class on the scroller, so a page can size the grid', () => {
    // The register makes its grid fill the pane this way. On the <table> it would do nothing,
    // because the element that scrolls is the wrapper.
    const { container } = render(
      <Table className="fills-the-pane" tableClassName="on-the-table">
        <tbody>
          <tr>
            <td>Row</td>
          </tr>
        </tbody>
      </Table>,
    );

    expect(container.firstElementChild?.classList.contains('fills-the-pane')).toBe(true);
    expect(container.querySelector('table')?.classList.contains('on-the-table')).toBe(true);
  });
});
