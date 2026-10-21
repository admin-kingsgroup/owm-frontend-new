import { describe, expect, it } from 'vitest';

import { portfolioMonths } from './history';
import type { TrajectoryPoint } from './types';

const point = (periodMonth: number, netProfit: number, periodYear = 2026): TrajectoryPoint => ({
  periodYear,
  periodMonth,
  turnover: String(netProfit * 10),
  netProfit: String(netProfit),
});

describe('portfolioMonths', () => {
  it('adds the businesses together month by month, oldest first', () => {
    const months = portfolioMonths([
      [point(2, 100), point(1, 50)],
      [point(1, 25), point(2, -40)],
    ]);

    expect(months.map((m) => [m.periodMonth, m.netProfit, m.turnover])).toEqual([
      [1, 75, 750],
      [2, 60, 600],
    ]);
  });

  it('says how many businesses stand behind each month', () => {
    const months = portfolioMonths([[point(1, 10), point(2, 10)], [point(2, 10)]]);
    expect(months.map((m) => m.reported)).toEqual([1, 2]);
  });

  it('orders across a year end and keeps only the latest months', () => {
    const months = portfolioMonths([[point(12, 1, 2025), point(1, 2), point(2, 3)]], 2);
    expect(months.map((m) => `${m.periodYear}-${m.periodMonth}`)).toEqual(['2026-1', '2026-2']);
  });

  it('is empty when nothing has been locked', () => {
    expect(portfolioMonths([[], []])).toEqual([]);
  });
});
