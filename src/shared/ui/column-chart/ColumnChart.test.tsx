// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ColumnChart } from './ColumnChart';

/**
 * The chart is the only thing on a report that a reader cannot check against the statement below,
 * because it is a shape rather than a figure. These cover the ways that shape can lie: a month
 * that happened drawn as nothing, a comparison series that is really a second copy of this year,
 * and a legend that names bars nobody can see instead of the chart naming itself once.
 */
describe('ColumnChart', () => {
  afterEach(cleanup);

  const months = ['Apr', 'May', 'Jun'];

  function renderChart(series: Array<{ label: string; color: string; values: number[] }>) {
    return render(
      <ColumnChart
        labels={months}
        series={series}
        caption="Income and expenses each month"
        scaleLabel={(value) => `max ${value}`}
        formatValue={(value) => value.toFixed(2)}
      />,
    );
  }

  const bars = () => document.querySelectorAll('svg rect[fill]');

  it('draws one bar per month per series', () => {
    renderChart([
      { label: 'Income', color: 'var(--data-1)', values: [10, 20, 30] },
      { label: 'Expenses', color: 'var(--data-2)', values: [5, 6, 7] },
    ]);

    expect(bars()).toHaveLength(6);
  });

  it('keeps a small month visible beside a very large one', () => {
    // 1 against 100_000 is a fraction of a pixel in a 168-unit box, which reads as "nothing
    // happened" — the one thing the chart must never say about a month that did happen.
    renderChart([{ label: 'Income', color: 'var(--data-1)', values: [100000, 1, 0] }]);

    const heights = [...bars()].map((bar) => Number(bar.getAttribute('height')));
    expect(heights[1]).toBeGreaterThanOrEqual(3);

    // A month that really is nil still draws nothing, so the floor is not applied indiscriminately.
    expect(heights[2]).toBe(0);
  });

  it('names itself once instead of reading its legend out', () => {
    renderChart([{ label: 'Income', color: 'var(--data-1)', values: [1, 2, 3] }]);

    // One accessible name for the picture...
    expect(screen.getByRole('img', { name: 'Income and expenses each month' })).toBeTruthy();

    // ...and the legend and axis labels are decoration on top of it, not a second reading of it.
    const legend = screen.getByText('Income').closest('[aria-hidden="true"]');
    expect(legend).not.toBeNull();
  });

  it('states the scale it drew against', () => {
    renderChart([{ label: 'Income', color: 'var(--data-1)', values: [10, 40, 30] }]);

    // Without this the tallest bar only says "the others are smaller".
    expect(screen.getByText('max 40')).toBeTruthy();
  });

  it('takes a fourth series for a comparison without losing this year', () => {
    renderChart([
      { label: 'Income', color: 'var(--data-1)', values: [10, 20, 30] },
      { label: 'Expenses', color: 'var(--data-2)', values: [5, 6, 7] },
      { label: 'Net · FY 2026-2027', color: 'var(--data-3)', values: [5, 14, 23] },
      { label: 'Net · FY 2025-2026', color: 'var(--data-4)', values: [4, 0, 9] },
    ]);

    // Twelve minus the one nil month: this year's net is still drawn, not replaced by last year's.
    expect(bars()).toHaveLength(12);
    expect(screen.getByText('Net · FY 2026-2027')).toBeTruthy();
    expect(screen.getByText('Net · FY 2025-2026')).toBeTruthy();

    const colours = new Set([...bars()].map((bar) => bar.getAttribute('fill')));
    expect(colours.size).toBe(4);
  });

  it('draws nothing at all rather than an empty frame', () => {
    const { container } = render(<ColumnChart labels={[]} series={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('survives a period where every figure is zero', () => {
    // max - min is 0 here, and dividing every bar by it would put NaN in the height attribute.
    renderChart([{ label: 'Income', color: 'var(--data-1)', values: [0, 0, 0] }]);

    for (const bar of bars()) {
      expect(Number.isNaN(Number(bar.getAttribute('height')))).toBe(false);
    }
  });
});
