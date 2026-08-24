import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Company } from '@/entities/company';
import { getRanking, listBusinesses } from '@/entities/kg';
import type { Business, PortfolioView } from '@/entities/kg';
import { cn, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';
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

      setBusinesses(registry.status === 'fulfilled' ? registry.value : null);
      setLoading(false);
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

  /**
   * A ratio, or nothing.
   *
   * Null where the denominator was nil, and printed as a dash rather than as 0%. "0% return" is a
   * claim about a business that made none; "no return to measure" is the truth, and the two lead to
   * opposite decisions.
   */
  const percent = (value?: string) =>
    value === undefined ? <span className={styles.nil}>—</span> : `${Number(value).toFixed(1)}%`;

  /**
   * Whether a target was met, missed, or had nothing to measure. The third case is drawn as a dash
   * for the same reason — a business with no turnover did not miss a margin target.
   */
  const verdict = (met?: boolean) =>
    met === undefined ? (
      <span className={styles.nil}>—</span>
    ) : (
      <span className={met ? styles.met : styles.warn}>{met ? 'met' : 'missed'}</span>
    );

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

  const monthName = new Date(Date.UTC(period.year, period.month - 1, 1)).toLocaleString(
    localeFor(company.country),
    { month: 'long', timeZone: 'UTC' },
  );

  const league = (view?.businesses ?? []).slice(0, LEAGUE_LIMIT);

  return (
    <div className={styles.gateway}>
      <DashboardHeader
        company={company}
        kind={`Portfolio dashboard · ${monthName} ${period.year}`}
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
        <Link className={styles.kpi} to={`${base}/kg`}>
          <span className={styles.kpiLabel}>Reporting</span>
          <span className={cn(styles.kpiValue, missing.length > 0 && styles.kpiWarn)}>
            {measured === null || measured === 0 ? (
              <span className={styles.nil}>—</span>
            ) : (
              `${reporting} of ${measured}`
            )}
          </span>
          <span className={styles.kpiHint}>
            {/*
              Three different silences, and they mean different things. Nothing in the registry is
              a workspace nobody has filled in; a registry with nothing to measure is a month none
              of them traded in; and a full count is the only one of the three that is good news.
            */}
            {measured === null
              ? 'Reading the portfolio…'
              : measured === 0
                ? registrySize === 0
                  ? 'No businesses in the registry yet'
                  : `No business reported ${monthName}`
                : missing.length === 0
                  ? 'Every business has reported this month'
                  : `${missing.length} yet to report — the totals beside this exclude ${missing.length === 1 ? 'it' : 'them'}`}
          </span>
        </Link>

        {/*
          A total over no businesses is not nought — it is nothing to total. Printed as 0.00 it
          reads as a portfolio that turned over nothing this month, which is a statement about
          trading rather than about reporting, and the two call for opposite reactions.
        */}
        <Link className={styles.kpi} to={`${base}/kg`}>
          <span className={styles.kpiLabel}>Turnover</span>
          <span className={styles.kpiValue}>
            {view && reporting > 0 ? (
              money(view.totals.turnover)
            ) : (
              <span className={styles.nil}>—</span>
            )}
          </span>
          {view && (
            <span className={styles.kpiHint}>
              {reporting > 0 ? `In ${view.portfolioCurrency}` : `Nothing locked for ${monthName}`}
            </span>
          )}
        </Link>

        <Link className={styles.kpi} to={`${base}/kg`}>
          <span className={styles.kpiLabel}>Net profit</span>
          <span
            className={cn(
              styles.kpiValue,
              view !== null && Number(view.totals.netProfit) < 0 && styles.kpiNegative,
            )}
          >
            {view && reporting > 0 ? (
              money(view.totals.netProfit)
            ) : (
              <span className={styles.nil}>—</span>
            )}
          </span>
          {view && reporting > 0 && (
            <span className={styles.kpiHint}>Margin {percent(view.totals.netMarginPercent)}</span>
          )}
        </Link>

        <Link className={styles.kpi} to={`${base}/kg`}>
          <span className={styles.kpiLabel}>Capital deployed</span>
          <span className={styles.kpiValue}>
            {view && reporting > 0 ? (
              money(view.totals.cumulativeCapitalInjected)
            ) : (
              <span className={styles.nil}>—</span>
            )}
          </span>
          {view && reporting > 0 && (
            <span className={styles.kpiHint}>Return {percent(view.totals.roiPercent)}</span>
          )}
        </Link>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              League table
              {view && league.length < view.businesses.length && (
                <span className={styles.asOn}>top {league.length}</span>
              )}
            </h2>

            {loading && !view && <p className={styles.pending}>Reading the portfolio…</p>}

            {view && view.businesses.length === 0 && (
              <p className={styles.clear}>No business has locked a snapshot for {monthName} yet.</p>
            )}

            {league.length > 0 && (
              /* One business per row with named fields — a record list, so it stacks on a phone. */
              <table className={styles.figures} data-stack>
                <thead>
                  <tr>
                    <th className={styles.figuresHeading}>Business</th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>
                      Net profit{view ? ` · ${view.portfolioCurrency}` : ''}
                    </th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>Return</th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {league.map((business) => (
                    <tr key={business.businessId} className={styles.figureRow}>
                      <td data-label="Business">
                        <Link className={styles.figureLink} to={`${base}/kg`}>
                          {business.businessName}
                        </Link>
                      </td>
                      <td className={styles.amount} data-label="Net profit">
                        {money(business.netProfit)}
                      </td>
                      <td className={styles.amount} data-label="Return">
                        {percent(business.roiPercent)}
                      </td>
                      <td className={styles.amount} data-label="Margin">
                        {percent(business.netMarginPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row" colSpan={4}>
                      <Link className={styles.figureLink} to={`${base}/kg`}>
                        Full portfolio, partner statements and imports
                      </Link>
                    </th>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
          {/*
            Only where something has been measured. Drawn regardless, this was a heading row with
            nothing beneath it — which reads as a table that failed rather than as a month nobody
            has reported for, and the tile at the top already says which.
          */}
          {view && view.businesses.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Against target</h2>
              <table className={styles.figures} data-stack>
                <thead>
                  <tr>
                    <th className={styles.figuresHeading}>Business</th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>
                      Return {view.targets.roiPercentPerMonth}%
                    </th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>
                      Margin {view.targets.netMarginPercentPerMonth}%
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.businesses.map((business) => (
                    <tr key={business.businessId} className={styles.figureRow}>
                      <td data-label="Business">{business.businessName}</td>
                      <td className={styles.amount} data-label="Return">
                        {verdict(business.meetsRoiTarget)}
                      </td>
                      <td className={styles.amount} data-label="Margin">
                        {verdict(business.meetsMarginTarget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <div className={styles.column}>
          {/*
            The businesses that have not reported. Above the target card, because a target verdict
            over an incomplete portfolio is the more misleading of the two.
          */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Yet to report</h2>
            {missing.length === 0 ? (
              <p className={styles.clear}>
                {view === null
                  ? 'Checking…'
                  : measured === 0
                    ? 'Nothing to report on yet.'
                    : `Every trading business has locked ${monthName}.`}
              </p>
            ) : (
              missing.map((name) => (
                <Link className={styles.item} key={name} to={`${base}/kg`}>
                  <span className={styles.warn}>{name}</span>
                </Link>
              ))
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Registries</h2>
            {/*
              One link, not three. The portfolio screen holds businesses, partners and imports as
              panels of itself, and which panel is open is its own state rather than part of the
              address — so three entries here would have been three different promises landing on
              the same panel, which is worse than one honest one.
            */}
            <Link className={styles.item} to={`${base}/kg`}>
              <span>Businesses, partners &amp; statement imports</span>
              {businesses && <span className={styles.count}>{businesses.length}</span>}
            </Link>
            <Link className={styles.item} to={`${base}?tab=settings`}>
              <span>Features &amp; settings</span>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
