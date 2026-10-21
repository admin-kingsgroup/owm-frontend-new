import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChartNoAxesCombined, Percent, Target, TrendingUp, TriangleAlert } from 'lucide-react';

import type { Company } from '@/entities/company';
import {
  getPartnerStatement,
  getRanking,
  getTrajectory,
  periodLabel,
  RankingTable,
  ratio,
  TargetScatter,
} from '@/entities/kg';
import type {
  Business,
  Partner,
  PartnerStatement,
  PortfolioView,
  TrajectoryPoint,
} from '@/entities/kg';
import {
  ChartLegend,
  DonutChart,
  EmptyState,
  KpiTile,
  LineChart,
  Loading,
  Table,
} from '@/shared/ui';
import { cn, formatCompactMoney, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface PortfolioPanelProps {
  company: Company;
  partners: Partner[];
  businesses: Business[];
  year: number;
  month: number;
}

/** One colour per business on the trend, in the order the registry lists them. */
const LINE_COLOURS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--seq-3)',
  'var(--seq-5)',
];

/**
 * How every business did in one month, ranked, and what each partner is owed.
 *
 * Two things are shown that a dashboard usually hides. Businesses **still trading but yet to
 * report** are listed by name, so a short portfolio never reads as a complete one. And a target
 * verdict is left blank rather than shown as a failure where the ratio had no denominator — a
 * business with no turnover did not miss a margin target, it had no margin to measure.
 */
export function PortfolioPanel({
  company,
  partners,
  businesses,
  year,
  month,
}: PortfolioPanelProps) {
  const [view, setView] = useState<PortfolioView | null>(null);
  const [trajectories, setTrajectories] = useState<Record<string, TrajectoryPoint[]>>({});
  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await getRanking(company.id, year, month);
        if (!cancelled) {
          setView(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the portfolio'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [company.id, year, month]);

  /*
    Each business's locked months, for the trend. Not by month — the history is the history — so
    read once per registry rather than every time the month changes. One that will not read is left
    off the chart rather than failing the tab.
  */
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled(
      businesses.map((business) => getTrajectory(company.id, business.id)),
    ).then((results) => {
      if (cancelled) return;
      setTrajectories(
        Object.fromEntries(
          results.map((result, i) => [
            businesses[i].id,
            result.status === 'fulfilled' ? result.value : [],
          ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [company.id, businesses]);

  // The statement follows the partner chosen and the month in the header; there is no button.
  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;
    getPartnerStatement(company.id, partnerId, year, month)
      .then((result) => {
        if (!cancelled) setStatement(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatement(null);
          setError(getErrorMessage(err, 'Could not build the statement'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, partnerId, year, month]);

  const currency = view?.portfolioCurrency ?? company.baseCurrency;
  const money = (value: string | number) =>
    formatMoney(value, { country: company.country, currency });
  const moneyNumber = (value: number) => money(value);
  const axis = (value: number) => formatCompactMoney(value, { country: company.country, currency });
  const locale = localeFor(company.country);
  const monthName = `${periodLabel(year, month, locale, 'long')} ${year}`;

  /*
    The trend's months: every month any business locked, in order, with a gap — not a nought —
    where a business had nothing locked that month.
  */
  const keys = [
    ...new Set(
      Object.values(trajectories).flatMap((points) =>
        points.map((p) => `${p.periodYear}-${String(p.periodMonth).padStart(2, '0')}`),
      ),
    ),
  ]
    .sort()
    .slice(-12);
  const trendLabels = keys.map((key) =>
    periodLabel(Number(key.slice(0, 4)), Number(key.slice(5)), locale, 'month'),
  );
  const trendTitles = keys.map(
    (key) =>
      `${periodLabel(Number(key.slice(0, 4)), Number(key.slice(5)), locale, 'long')} ${key.slice(0, 4)}`,
  );
  const trendSeries = businesses
    .filter((business) => (trajectories[business.id] ?? []).length > 0)
    .map((business, i) => {
      const byKey = new Map(
        (trajectories[business.id] ?? []).map((p) => [
          `${p.periodYear}-${String(p.periodMonth).padStart(2, '0')}`,
          Number(p.netProfit),
        ]),
      );
      return {
        label: business.name,
        color: LINE_COLOURS[i % LINE_COLOURS.length],
        values: keys.map((key) => byKey.get(key) ?? null),
      };
    });

  const reporting = view?.businesses.length ?? 0;
  const missing = view?.businessesWithoutLockedSnapshot ?? [];
  const measured = reporting + missing.length;

  const weights = view?.weights;
  const weightTotal = weights ? weights.roi + weights.netMargin + weights.netProfit : 0;
  const share = (weight: number) => `${Math.round((weight / weightTotal) * 100)}%`;

  // The ring only for shares that are all profit; a loss in any business leaves it to the table.
  const donutParts = (statement?.businesses ?? []).map((line, i) => ({
    label: line.businessName,
    value: Number(line.yourProfitShare),
    color: LINE_COLOURS[i % LINE_COLOURS.length],
  }));
  const donutDrawable =
    donutParts.length > 0 &&
    donutParts.every((part) => part.value >= 0) &&
    donutParts.some((part) => part.value > 0);

  return (
    <div className={styles.panel}>
      {error && <p className={styles.error}>{error}</p>}
      {loading && !view && <Loading label="Loading the portfolio…" />}

      {view && businesses.length === 0 && (
        <EmptyState
          title="No businesses to compare yet"
          description="Add businesses on the Businesses tab, then upload a month's statement for each."
        />
      )}

      {view && businesses.length > 0 && (
        <>
          <div className={styles.kpis}>
            <KpiTile
              index={0}
              label={`Turnover · ${monthName}`}
              icon={<ChartNoAxesCombined />}
              value={reporting > 0 ? Number(view.totals.turnover) : null}
              format={moneyNumber}
              hint={
                reporting > 0
                  ? `${reporting} of ${measured} business${measured === 1 ? '' : 'es'} reported`
                  : `Nothing locked for ${monthName}`
              }
            />
            <KpiTile
              index={1}
              label={`Net profit · ${monthName}`}
              icon={<TrendingUp />}
              value={reporting > 0 ? Number(view.totals.netProfit) : null}
              format={moneyNumber}
              negative={Number(view.totals.netProfit) < 0}
              hint={reporting > 0 && `In ${view.portfolioCurrency}`}
            />
            <KpiTile
              index={2}
              label="Net margin"
              icon={<Percent />}
              value={
                reporting > 0 && view.totals.netMarginPercent !== undefined
                  ? Number(view.totals.netMarginPercent)
                  : null
              }
              format={(value) => `${value.toFixed(1)}%`}
              hint={`Target ${view.targets.netMarginPercentPerMonth}% a month`}
            />
            <KpiTile
              index={3}
              label="Return on capital"
              icon={<Target />}
              value={
                reporting > 0 && view.totals.roiPercent !== undefined
                  ? Number(view.totals.roiPercent)
                  : null
              }
              format={(value) => `${value.toFixed(1)}%`}
              hint={
                reporting > 0
                  ? `Target ${view.targets.roiPercentPerMonth}% · ${money(view.totals.cumulativeCapitalInjected)} put in`
                  : `Target ${view.targets.roiPercentPerMonth}% a month`
              }
            />
          </div>

          {missing.length > 0 && (
            <p className={styles.shortfall} role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>
                Still to report for {monthName}: <b>{missing.join(', ')}</b>. The totals above are
                short of {missing.length === 1 ? 'it' : 'them'}.
              </span>
            </p>
          )}

          {view.businesses.length === 0 ? (
            <EmptyState
              title="Nothing locked for this month"
              description="A business appears here once its statement has been imported and the snapshot locked."
            />
          ) : (
            <section className={styles.card} style={{ '--i': 4 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Ranking</h2>
                {weights && weightTotal > 0 && (
                  <span className={styles.cardSub}>
                    return {share(weights.roi)} · margin {share(weights.netMargin)} · profit{' '}
                    {share(weights.netProfit)}
                  </span>
                )}
              </div>
              <RankingTable view={view} money={money} full />
            </section>
          )}

          {/* The two pictures under the table: where each business sits, and how it got there. */}
          <div className={styles.split}>
            {view.businesses.length > 0 && (
              <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Return against margin</h2>
                  <span className={styles.cardSub}>
                    targets {view.targets.roiPercentPerMonth}% and{' '}
                    {view.targets.netMarginPercentPerMonth}% a month
                  </span>
                </div>
                <TargetScatter view={view} />
              </section>
            )}

            {trendSeries.length > 0 && keys.length > 1 && (
              <section className={styles.card} style={{ '--i': 6 } as CSSProperties}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Net profit by business</h2>
                  <span className={styles.cardSub}>
                    every locked month, in {currency} — a gap is a month not reported
                  </span>
                  <ChartLegend
                    className={styles.cardRight}
                    items={trendSeries.map((series) => ({
                      label: series.label,
                      color: series.color,
                      line: true,
                    }))}
                  />
                </div>
                <LineChart
                  labels={trendLabels}
                  tooltipLabels={trendTitles}
                  series={trendSeries}
                  formatValue={moneyNumber}
                  formatAxis={axis}
                  caption="Each business's net profit for every locked month"
                />
              </section>
            )}
          </div>
        </>
      )}

      {partners.length > 0 && (
        <section className={styles.card} style={{ '--i': 7 } as CSSProperties}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Partner statement</h2>
            <span className={styles.cardSub}>
              {monthName} · what gets sent, so it shows their figures only
            </span>
          </div>

          <div className={styles.chips} role="group" aria-label="Partner">
            {partners.map((partner) => (
              <button
                key={partner.id}
                type="button"
                className={cn(styles.chip, partner.id === partnerId && styles.chipOn)}
                aria-pressed={partner.id === partnerId}
                onClick={() => setPartnerId(partner.id)}
              >
                {partner.name}
              </button>
            ))}
          </div>

          {statement && statement.partnerId === partnerId && (
            <div className={styles.statement}>
              <div className={styles.statementTable}>
                {statement.businesses.length === 0 ? (
                  <p className={styles.hint}>
                    {statement.partnerName} has no share in a business that reported {monthName}.
                  </p>
                ) : (
                  <Table surface="plain" stack zebra={false}>
                    <thead>
                      <tr>
                        <th>Business</th>
                        <th data-num>Share</th>
                        <th data-num>Business profit</th>
                        <th data-num>Their profit</th>
                        <th data-num>Their capital</th>
                        <th data-num>Their return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.businesses.map((line) => (
                        <tr key={line.businessId}>
                          <td>{line.businessName}</td>
                          <td data-num>{Number(line.profitSharePercent)}%</td>
                          <td data-num>{money(line.businessNetProfit)}</td>
                          <td data-num>
                            <strong>{money(line.yourProfitShare)}</strong>
                          </td>
                          <td data-num>{money(line.yourCapital)}</td>
                          <td data-num>{ratio(line.yourReturnPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td />
                        <td />
                        <td data-num>
                          <strong>{money(statement.totals.profitShare)}</strong>
                        </td>
                        <td data-num>
                          <strong>{money(statement.totals.capital)}</strong>
                        </td>
                        <td data-num>
                          <strong>{ratio(statement.totals.returnPercent)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                )}
              </div>

              {donutDrawable && (
                <div className={styles.donutBox}>
                  <DonutChart
                    parts={donutParts}
                    formatValue={moneyNumber}
                    center={axis(Number(statement.totals.profitShare))}
                    sub="their share"
                    caption={`Where ${statement.partnerName}'s profit share comes from, by business`}
                  />
                  <ChartLegend
                    items={donutParts.map((part) => ({ label: part.label, color: part.color }))}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
