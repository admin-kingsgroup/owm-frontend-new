import type { TrajectoryPoint } from './types';

export interface PortfolioMonth {
  periodYear: number;
  periodMonth: number;
  turnover: number;
  netProfit: number;
  /** How many businesses had locked this month — a total over fewer is short, not smaller. */
  reported: number;
}

/**
 * The portfolio month by month: every business's locked months added together.
 *
 * Each trajectory is already in the portfolio's currency, converted at that month's own rate, so
 * the sum is a sum of like with like. A month is kept with the count of businesses behind it, so a
 * dip that is really a business yet to report can be told apart from a business doing worse.
 *
 * The last `limit` months only, oldest first.
 */
export function portfolioMonths(trajectories: TrajectoryPoint[][], limit = 12): PortfolioMonth[] {
  const byPeriod = new Map<string, PortfolioMonth>();

  for (const trajectory of trajectories) {
    for (const point of trajectory) {
      const key = `${point.periodYear}-${String(point.periodMonth).padStart(2, '0')}`;
      const month = byPeriod.get(key) ?? {
        periodYear: point.periodYear,
        periodMonth: point.periodMonth,
        turnover: 0,
        netProfit: 0,
        reported: 0,
      };
      byPeriod.set(key, {
        ...month,
        turnover: month.turnover + Number(point.turnover),
        netProfit: month.netProfit + Number(point.netProfit),
        reported: month.reported + 1,
      });
    }
  }

  return [...byPeriod.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, month]) => month)
    .slice(-limit);
}

/**
 * The month a period names, in the company's own locale: "Oct 26" (short), "October" (long), or
 * "Oct" alone (month) — the last for a chart axis, where twelve labels share a phone's width.
 */
export function periodLabel(
  year: number,
  month: number,
  locale?: string,
  style: 'short' | 'long' | 'month' = 'short',
): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString(locale, {
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'short' ? { year: '2-digit' } : {}),
    timeZone: 'UTC',
  });
}
