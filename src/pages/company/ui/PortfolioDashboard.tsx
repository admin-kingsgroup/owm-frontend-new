import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Coins,
  Settings2,
  TrendingUp,
  Upload,
} from 'lucide-react';

import type { Company } from '@/entities/company';
import {
  getRanking,
  getTrajectory,
  listBusinesses,
  periodLabel,
  portfolioMonths,
  RankingTable,
  ratio,
  TargetScatter,
} from '@/entities/kg';
import type { Business, PortfolioMonth, PortfolioView } from '@/entities/kg';
import { cn, formatCompactMoney, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';
import { BarChart, KpiTile } from '@/shared/ui';
import { DashboardHeader } from '@/widgets/dashboard-header';

import styles from './CompanyGateway.module.css';

interface PortfolioDashboardProps {
  company: Company;
}

/** The month being reported on, as at the moment the screen opens. */
function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * How many businesses the league table shows before it defers to the portfolio screen. The point of
 * a dashboard ranking is who is at the top, not the full order.
 */
const LEAGUE_LIMIT = 5;

/**
 * The dashboard for an analytics workspace — KG Business and anything else that measures companies
 * it does not keep books for.
 *
 * It answers a different question from the accounting dashboard, which is why it is a different
 * screen rather than the same one with the cash tiles blanked out. Nothing is posted here: figures
 * arrive as month-end statements, are mapped once per business, and are locked into snapshots. So
 * there is no cash position, no drafts and no trial balance — there is how each business did, and
 * whether every business has actually reported yet.
 *
 * That last part is the one thing this screen will not let slide. A portfolio quietly missing two
 * of six businesses reads exactly like a complete one, so the businesses yet to report are a figure
 * at the top rather than a footnote at the bottom.
 */
export function PortfolioDashboard({ company }: PortfolioDashboardProps) {
  const base = `/companies/${company.id}`;

  const [period] = useState(currentPeriod);
  const [view, setView] = useState<PortfolioView | null>(null);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [history, setHistory] = useState<PortfolioMonth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = company.id;
    let cancelled = false;

    async function load() {
      setLoading(true);

      /*
        The registry as well as the ranking, settled separately.

        The ranking is the screen; the registry only tells an empty portfolio apart from an empty
        month — a distinction worth drawing, and not worth failing the page over. Read together it
        used to take the whole screen down whenever the cheaper of the two happened to fail.
      */
      const [ranking, registry] = await Promise.allSettled([
        getRanking(id, period.year, period.month),
        listBusinesses(id),
      ]);

      if (cancelled) return;

      if (ranking.status === 'fulfilled') {
        setView(ranking.value);
        setError(null);
      } else {
        setError(getErrorMessage(ranking.reason, 'Could not read the portfolio'));
      }

      const registered = registry.status === 'fulfilled' ? registry.value : null;
      setBusinesses(registered);
      setLoading(false);

      /*
        The months behind this one, for the trend — each business's own locked history, added up.
        Last and on its own, because it is a picture of the past: a business whose history will not
        read leaves the chart short of it rather than the screen short of everything.
      */
      if (!registered || registered.length === 0) return;
      const trajectories = await Promise.allSettled(
        registered.map((business) => getTrajectory(id, business.id)),
      );
      if (cancelled) return;
      setHistory(
        portfolioMonths(
          trajectories.map((result) => (result.status === 'fulfilled' ? result.value : [])),
        ),
      );
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [company.id, period.year, period.month]);

  /**
   * Figures are converted to the portfolio's own currency before they are ranked, so they are
   * written in it. The businesses themselves keep their own — a row in the league table says which.
   */
  const money = (value: string | number, currency?: string) =>
    formatMoney(value, { country: company.country, currency });
  const moneyNumber = (value: number) => money(value);
  const axis = (value: number) =>
    formatCompactMoney(value, { country: company.country, currency: view?.portfolioCurrency });

  const reporting = view?.businesses.length ?? 0;
  /*
    Named by the ranking itself. It lists the businesses it knows are still trading and have not
    locked a snapshot for the month — which is not the same as the registry minus the reporters, and
    is the list the reader is entitled to see rather than a number to reconcile themselves.
  */
  const missing = view?.businessesWithoutLockedSnapshot ?? [];

  /**
   * How many businesses this month is measured over: the ones that reported plus the ones still to.
   *
   * Not the count of active businesses in the registry, which was the first version of this and was
   * wrong in a way that showed. A business that traded in April and has closed since still reported
   * April, so the ranking counts it — while the registry no longer counts it as active, and the
   * tile read "3 of 2". Both halves come from the same payload now, so the fraction cannot exceed
   * itself.
   */
  const measured = view ? view.businesses.length + missing.length : null;
  /** Only to tell an empty registry apart from a month nobody traded in. Null if it failed to read. */
  const registrySize = businesses?.length ?? null;

  const locale = localeFor(company.country);
  const monthName = periodLabel(period.year, period.month, locale, 'long');
  const monthLabels = history.map((month) =>
    periodLabel(month.periodYear, month.periodMonth, locale, 'month'),
  );
  const monthTitles = history.map(
    (month) =>
      `${periodLabel(month.periodYear, month.periodMonth, locale, 'long')} ${month.periodYear}`,
  );

  const weights = view?.weights;
  const weightTotal = weights ? weights.roi + weights.netMargin + weights.netProfit : 0;
  const share = (weight: number) => `${Math.round((weight / weightTotal) * 100)}%`;

  return (
    <div className={styles.gateway}>
      <DashboardHeader
        company={company}
        kind={`Portfolio dashboard · ${monthName} ${period.year}`}
        actions={
          <Link className={cn(styles.action, styles.actionPrimary)} to={`${base}/kg`}>
            <BriefcaseBusiness size={15} aria-hidden="true" />
            Open portfolio
          </Link>
        }
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.kpis}>
        {/*
          First, and deliberately so. Every figure to the right of it is a total over the businesses
          that reported — and means nothing until you know how many did.
        */}
        <KpiTile
          index={0}
          label="Reporting"
          icon={<Building2 />}
          value={measured === null || measured === 0 ? null : reporting}
          display={`${reporting} of ${measured}`}
          format={String}
          to={`${base}/kg`}
          hint={
            /*
              Three different silences, and they mean different things. Nothing in the registry is
              a workspace nobody has filled in; a registry with nothing to measure is a month none
              of them traded in; and a full count is the only one of the three that is good news.
            */
            measured === null
              ? 'Reading the portfolio…'
              : measured === 0
                ? registrySize === 0
                  ? 'No businesses in the registry yet'
                  : `No business reported ${monthName}`
                : missing.length === 0
                  ? 'Every business has reported this month'
                  : `${missing.length} yet to report — the totals beside this exclude ${missing.length === 1 ? 'it' : 'them'}`
          }
        />

        {/*
          A total over no businesses is not nought — it is nothing to total. Printed as 0.00 it
          reads as a portfolio that turned over nothing this month, which is a statement about
          trading rather than about reporting, and the two call for opposite reactions.
        */}
        <KpiTile
          index={1}
          label="Turnover"
          icon={<ChartNoAxesCombined />}
          value={view && reporting > 0 ? Number(view.totals.turnover) : null}
          format={moneyNumber}
          to={`${base}/kg`}
          hint={
            view &&
            (reporting > 0 ? `In ${view.portfolioCurrency}` : `Nothing locked for ${monthName}`)
          }
          trend={history.length > 1 ? history.map((month) => month.turnover) : undefined}
          trendLabels={monthTitles}
          trendColor="var(--series-1)"
        />

        <KpiTile
          index={2}
          label="Net profit"
          icon={<TrendingUp />}
          value={view && reporting > 0 ? Number(view.totals.netProfit) : null}
          format={moneyNumber}
          negative={view !== null && Number(view.totals.netProfit) < 0}
          to={`${base}/kg`}
          hint={view && reporting > 0 && `Margin ${ratio(view.totals.netMarginPercent)}`}
          trend={history.length > 1 ? history.map((month) => month.netProfit) : undefined}
          trendLabels={monthTitles}
          trendColor="var(--series-4)"
        />

        <KpiTile
          index={3}
          label="Capital deployed"
          icon={<Coins />}
          value={view && reporting > 0 ? Number(view.totals.cumulativeCapitalInjected) : null}
          format={moneyNumber}
          to={`${base}/kg`}
          hint={view && reporting > 0 && `Return ${ratio(view.totals.roiPercent)} a month`}
        />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.card} style={{ '--i': 4 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>League table</h2>
              {weights && weightTotal > 0 && (
                <span className={styles.cardSub}>
                  return {share(weights.roi)} · margin {share(weights.netMargin)} · profit{' '}
                  {share(weights.netProfit)}
                </span>
              )}
              {view && view.businesses.length > LEAGUE_LIMIT && (
                <span className={cn(styles.cardRight, styles.count)}>top {LEAGUE_LIMIT}</span>
              )}
            </div>

            {loading && !view && <p className={styles.pending}>Reading the portfolio…</p>}

            {view && view.businesses.length === 0 && (
              <p className={styles.clear}>No business has locked a snapshot for {monthName} yet.</p>
            )}

            {view && view.businesses.length > 0 && (
              <>
                <RankingTable
                  view={view}
                  money={money}
                  limit={LEAGUE_LIMIT}
                  linkTo={`${base}/kg`}
                />
                <Link className={styles.more} to={`${base}/kg`}>
                  Full portfolio, partner statements and imports
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </>
            )}
          </section>

          {/* Only once there are months to compare — one month is a figure, not a trend. */}
          {history.length > 1 && (
            <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Net profit, month by month</h2>
                <span className={styles.cardSub}>
                  every locked month, in {view?.portfolioCurrency ?? company.baseCurrency}
                </span>
              </div>
              <BarChart
                labels={monthLabels}
                tooltipLabels={monthTitles}
                series={[
                  {
                    label: 'Net profit',
                    color: 'var(--series-1)',
                    values: history.map((month) => month.netProfit),
                  },
                ]}
                formatValue={moneyNumber}
                formatAxis={axis}
                footer={(i) => ({
                  color: 'transparent',
                  label: 'Reported',
                  value: `${history[i].reported} business${history[i].reported === 1 ? '' : 'es'}`,
                })}
                caption="The portfolio's net profit for each locked month"
              />
            </section>
          )}
        </div>

        <div className={styles.column}>
          {/*
            The businesses that have not reported. Above the target card, because a target verdict
            over an incomplete portfolio is the more misleading of the two.
          */}
          <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Yet to report</h2>
              <span className={styles.cardSub}>still trading, no locked month</span>
            </div>
            {missing.length === 0 ? (
              <p className={styles.clear}>
                {view === null
                  ? 'Checking…'
                  : measured === 0
                    ? 'Nothing to report on yet.'
                    : `Every trading business has locked ${monthName}.`}
              </p>
            ) : (
              <div className={styles.masters}>
                {missing.map((name) => (
                  <Link
                    className={cn(styles.master, styles.pendingRow)}
                    key={name}
                    to={`${base}/kg`}
                  >
                    <span className={styles.pendingBar} aria-hidden="true" />
                    <span className={styles.pendingText}>
                      <b>{name}</b>
                      <span>No locked snapshot for {monthName}</span>
                    </span>
                    <Upload size={15} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/*
            Only where something has been measured. Drawn regardless, this was a heading row with
            nothing beneath it — which reads as a table that failed rather than as a month nobody
            has reported for, and the tile at the top already says which.
          */}
          {view && view.businesses.length > 0 && (
            <section className={styles.card} style={{ '--i': 6 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Against target</h2>
                <span className={styles.cardSub}>
                  Return {view.targets.roiPercentPerMonth}% · Margin{' '}
                  {view.targets.netMarginPercentPerMonth}% a month
                </span>
              </div>
              <TargetScatter view={view} height={240} />
            </section>
          )}

          <section className={styles.card} style={{ '--i': 7 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Registries</h2>
            </div>
            {/*
              One link, not three. The portfolio screen holds businesses, partners and imports as
              panels of itself, and which panel is open is its own state rather than part of the
              address — so three entries here would have been three different promises landing on
              the same panel, which is worse than one honest one.
            */}
            <div className={styles.masters}>
              <Link className={styles.master} to={`${base}/kg`}>
                <Building2 size={15} aria-hidden="true" />
                <span>Businesses, partners &amp; statement imports</span>
                {businesses && <span className={styles.count}>{businesses.length}</span>}
              </Link>
              <Link className={styles.master} to={`${base}?tab=settings`}>
                <Settings2 size={15} aria-hidden="true" />
                <span>Features &amp; settings</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
