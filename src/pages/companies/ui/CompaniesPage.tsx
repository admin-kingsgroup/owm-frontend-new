import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CircleCheck,
  CircleDollarSign,
  FileClock,
  Landmark,
  Layers,
  Pencil,
  Plus,
  TrendingUp,
  UserX,
} from 'lucide-react';

import {
  companyAccent,
  companyInitials,
  companyStatusVariant,
  companyTypeLabel,
  useCompanyStore,
} from '@/entities/company';
import type { Company } from '@/entities/company';
import { getGroupOverview } from '@/entities/report';
import type { CompanyOverview, GroupOverview } from '@/entities/report';
import { CreateCompanyForm, EditCompanyForm } from '@/features/company';
import {
  Badge,
  Button,
  ChartLegend,
  EmptyState,
  IconButton,
  KpiTile,
  LineChart,
  Loading,
  Modal,
} from '@/shared/ui';
import { cn, formatCompactMoney, formatMoney, getErrorMessage, localeFor } from '@/shared/lib';

import styles from './CompaniesPage.module.css';

/** The colours a group chart gives its companies, in order, never cycled — a fifth is left out. */
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

interface Tile {
  key: string;
  label: string;
  icon: ReactNode;
  value: number;
  format: (value: number) => string;
  negative: boolean;
  trend?: number[];
  trendColor?: string;
}

/**
 * The group overview: every company's cash, profit and unfinished work side by side, and the way
 * into any one of them.
 */
export function CompaniesPage() {
  const navigate = useNavigate();

  // One shared list, so the switcher and this page cannot disagree and a company created here is
  // visible everywhere immediately.
  const companies = useCompanyStore((state) => state.companies);
  const companiesLoaded = useCompanyStore((state) => state.loaded);
  const companiesError = useCompanyStore((state) => state.error);
  const loadCompanies = useCompanyStore((state) => state.load);
  const upsertCompany = useCompanyStore((state) => state.upsert);

  const [overview, setOverview] = useState<GroupOverview | null>(null);
  /** The figures failing is a degraded page, not a broken one — kept apart from `error`. */
  const [figuresError, setFiguresError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The list and the figures are independent: either failing must not take the other down. The
    // list is owned by the store; only the figures are local to this screen.
    void loadCompanies();
    getGroupOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setFiguresError(getErrorMessage(err, 'Could not load figures for these companies'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadCompanies]);

  /**
   * Which country's conventions to group a figure by. A per-currency total has no single company
   * behind it, so it takes the country of the first company using that currency.
   */
  const countryOf = useCallback(
    (currency: string) => companies?.find((c) => c.baseCurrency === currency)?.country,
    [companies],
  );

  const figuresById = useMemo(
    () => new Map((overview?.companies ?? []).map((row) => [row.companyId, row])),
    [overview],
  );

  /**
   * One currency's companies added month by month — the shape behind a group total. Only companies
   * that could be read count, and only in their own currency: a group never has one cash position
   * across rupees and dollars.
   */
  const trendFor = useCallback(
    (currency: string, field: 'cashAndBank' | 'netProfit') => {
      const byMonth = new Map<string, number>();
      for (const row of overview?.companies ?? []) {
        if (row.error || row.baseCurrency !== currency) continue;
        for (const point of row.trend) {
          byMonth.set(point.month, (byMonth.get(point.month) ?? 0) + Number(point[field]));
        }
      }
      return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
    },
    [overview],
  );

  /**
   * The headline tiles. Currencies are kept apart because the API totals them apart — a group
   * holding an INR company beside a USD one has no single cash position.
   */
  const tiles = useMemo<Tile[]>(() => {
    if (!overview) return [];

    const { totals } = overview;
    const multiCurrency = totals.byCurrency.length > 1;

    // With a single company the tiles would restate that company's own card word for word. The
    // counts still earn their place, because the card does not carry them.
    const currencyTiles: Tile[] =
      totals.companyCount <= 1
        ? []
        : totals.byCurrency.flatMap((total, index) => {
            const country = countryOf(total.currency);
            const format = (value: number) =>
              formatMoney(value, { currency: total.currency, country });
            return [
              {
                key: `${total.currency}-cash`,
                label: multiCurrency ? `Cash & bank · ${total.currency}` : 'Cash & bank',
                icon: index === 0 ? <Landmark /> : <CircleDollarSign />,
                value: Number(total.cashAndBank),
                format,
                negative: Number(total.cashAndBank) < 0,
                trend: trendFor(total.currency, 'cashAndBank'),
                trendColor: SERIES[index % SERIES.length],
              },
              {
                key: `${total.currency}-profit`,
                label: multiCurrency ? `Net profit · ${total.currency}` : 'Net profit',
                icon: <TrendingUp />,
                value: Number(total.netProfit),
                format,
                negative: Number(total.netProfit) < 0,
              },
            ];
          });

    return [
      ...currencyTiles,
      {
        key: 'drafts',
        label: 'Awaiting posting',
        icon: <FileClock />,
        value: totals.draftVoucherCount,
        format: (value: number) => String(Math.round(value)),
        negative: false,
      },
      {
        key: 'years',
        label: 'Open years',
        icon: <CalendarCheck />,
        value: totals.openYearCount,
        format: (value: number) => `${Math.round(value)} of ${totals.companyCount}`,
        negative: false,
      },
      // Only worth a slot when there is something to explain — it is the reason the figures above
      // do not add up to what the list below shows.
      ...(totals.inactiveCount > 0
        ? [
            {
              key: 'inactive',
              label: 'Deactivated',
              icon: <UserX />,
              value: totals.inactiveCount,
              format: (value: number) => `${Math.round(value)} · not counted`,
              negative: false,
            },
          ]
        : []),
    ];
  }, [overview, countryOf, trendFor]);

  /**
   * The group chart: cash and bank month by month for each company in the group's main currency.
   * One currency per chart, because one axis cannot hold rupees and dollars honestly.
   */
  const chart = useMemo(() => {
    const rows = (overview?.companies ?? []).filter((row) => !row.error && row.trend.length > 1);
    if (rows.length === 0) return null;

    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.baseCurrency, (counts.get(row.baseCurrency) ?? 0) + 1));
    const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const chosen = rows.filter((row) => row.baseCurrency === currency).slice(0, SERIES.length);
    const months = [
      ...new Set(chosen.flatMap((row) => row.trend.map((point) => point.month))),
    ].sort();
    if (months.length < 2) return null;

    const country = countryOf(currency);
    const short = new Intl.DateTimeFormat(localeFor(country), { month: 'short', timeZone: 'UTC' });
    const long = new Intl.DateTimeFormat(localeFor(country), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return {
      currency,
      country,
      labels: months.map((month) => short.format(new Date(month))),
      tooltipLabels: months.map((month) => long.format(new Date(month))),
      series: chosen.map((row, index) => {
        const byMonth = new Map(row.trend.map((point) => [point.month, Number(point.cashAndBank)]));
        return {
          label: row.name,
          color: SERIES[index],
          values: months.map((month) => byMonth.get(month) ?? null),
        };
      }),
    };
  }, [overview, countryOf]);

  /** What wants doing, company by company — each line a link to where it is done. */
  const attention = useMemo(() => {
    const items: Array<{ key: string; company: string; text: string; to: string; bad: boolean }> =
      [];
    for (const row of overview?.companies ?? []) {
      if (row.status !== 'ACTIVE') continue;
      if (row.error) {
        items.push({
          key: `${row.companyId}-error`,
          company: row.name,
          text: row.error,
          to: `/companies/${row.companyId}`,
          bad: true,
        });
        continue;
      }
      if (row.draftVoucherCount > 0) {
        items.push({
          key: `${row.companyId}-drafts`,
          company: row.name,
          text: `${row.draftVoucherCount} draft ${row.draftVoucherCount === 1 ? 'voucher' : 'vouchers'} awaiting posting`,
          to: `/companies/${row.companyId}/vouchers?status=DRAFT`,
          bad: false,
        });
      }
      if (row.financialYearStatus === 'CLOSED') {
        items.push({
          key: `${row.companyId}-closed`,
          company: row.name,
          text: `Financial year ${row.financialYearLabel ?? ''} is closed to new vouchers`,
          to: `/companies/${row.companyId}?tab=financial-years`,
          bad: false,
        });
      }
    }
    return items;
  }, [overview]);

  function handleCreated(company: Company) {
    upsertCompany(company);
    setCreateModalOpen(false);
    navigate(`/companies/${company.id}`);
  }

  function handleEdited(company: Company) {
    setEditingCompany(null);
    upsertCompany(company);
  }

  function renderFigures(figures: CompanyOverview | undefined, company: Company) {
    if (!figures) return null;

    // A company that cannot be reported on still belongs on the list. Saying why beats showing
    // zeroes that read as real balances.
    if (figures.error) {
      return <p className={styles.cardNotice}>{figures.error}</p>;
    }

    const money = (value: string) =>
      formatMoney(value, { currency: figures.baseCurrency, country: company.country });

    return (
      <>
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Cash &amp; bank</span>
            <span
              className={cn(
                styles.figureValue,
                Number(figures.cashAndBank) < 0 && styles.figureNegative,
              )}
            >
              {money(figures.cashAndBank)}
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Net profit</span>
            <span
              className={cn(
                styles.figureValue,
                Number(figures.netProfit) < 0 && styles.figureNegative,
              )}
            >
              {money(figures.netProfit)}
            </span>
          </div>
        </div>

        {/*
          Direction of travel only — the figure above carries the amount. Nothing is drawn before two
          months exist, rather than a flat line implying a history that is not there.
        */}
        {figures.trend.length > 1 && (
          <div className={styles.cardTrend}>
            <LineChart
              mini
              area
              height={52}
              labels={figures.trend.map((point) => point.month.slice(0, 7))}
              series={[
                {
                  label: 'Cash & bank',
                  color: companyAccent(company),
                  values: figures.trend.map((point) => Number(point.cashAndBank)),
                },
              ]}
              formatValue={(value) =>
                formatMoney(value, { currency: figures.baseCurrency, country: company.country })
              }
              caption={`Cash and bank over ${figures.trend.length} months`}
            />
          </div>
        )}

        <div className={styles.cardTags}>
          {figures.financialYearLabel && (
            <span
              className={cn(
                styles.tag,
                figures.financialYearStatus === 'CLOSED' && styles.tagMuted,
              )}
            >
              FY {figures.financialYearLabel}
              {figures.financialYearStatus === 'CLOSED' && ' · closed'}
            </span>
          )}
          {figures.draftVoucherCount > 0 && (
            <button
              type="button"
              className={styles.tagAction}
              onClick={() => navigate(`/companies/${company.id}/vouchers`)}
            >
              {figures.draftVoucherCount} awaiting posting
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>
            <Layers size={13} aria-hidden="true" />
            KBiz360 Group
            {companies
              ? ` · ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`
              : ''}
          </span>
          <h1 className={styles.title}>Group overview</h1>
          <p className={styles.subtitle}>
            Cash, profit and unfinished work for every company side by side. Totals are kept per
            currency, so dollars are never added to rupees.
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={16} /> New company
        </Button>
      </div>

      {/*
        `loaded` rather than `companies !== null`: a failed request has no data either, and treating
        the two the same left the error message sitting above a spinner that never stopped.
      */}
      {!companiesLoaded ? (
        <Loading label="Loading companies…" />
      ) : companiesError ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Could not load companies"
          description={companiesError}
          action={
            <Button type="button" variant="ghost" onClick={() => void loadCompanies(true)}>
              Try again
            </Button>
          }
        />
      ) : !companies || companies.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No companies yet"
          description="Create your first company to auto-generate its chart of accounts, ledgers, and voucher types."
        />
      ) : (
        <>
          {tiles.length > 0 && (
            <div className={styles.totals}>
              {tiles.map((tile, index) => (
                <KpiTile
                  key={tile.key}
                  index={index}
                  label={tile.label}
                  icon={tile.icon}
                  value={tile.value}
                  format={tile.format}
                  negative={tile.negative}
                  trend={tile.trend}
                  trendColor={tile.trendColor}
                />
              ))}
            </div>
          )}

          {figuresError && (
            <p className={styles.notice} role="status">
              {figuresError}. The companies below are listed without their balances.
            </p>
          )}

          {(chart || overview) && (
            <div className={cn(styles.panels, !chart && styles.panelsSingle)}>
              {chart && (
                <section className={styles.panel} style={{ '--i': 4 } as CSSProperties}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>Cash &amp; bank by company</h2>
                    <span className={styles.panelSub}>{chart.currency}</span>
                    <ChartLegend
                      className={styles.panelRight}
                      items={chart.series.map((entry) => ({
                        label: entry.label,
                        color: entry.color,
                        line: true,
                      }))}
                    />
                  </div>
                  <LineChart
                    area
                    height={250}
                    labels={chart.labels}
                    tooltipLabels={chart.tooltipLabels}
                    series={chart.series}
                    formatValue={(value) =>
                      formatMoney(value, { currency: chart.currency, country: chart.country })
                    }
                    formatAxis={(value) =>
                      formatCompactMoney(value, {
                        currency: chart.currency,
                        country: chart.country,
                      })
                    }
                    caption={`Cash and bank month by month for each ${chart.currency} company`}
                  />
                </section>
              )}

              {overview && (
                <section className={styles.panel} style={{ '--i': 5 } as CSSProperties}>
                  <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>Needs attention</h2>
                    <span className={styles.panelSub}>across the group</span>
                  </div>
                  <ul className={styles.attention}>
                    {attention.map((item) => (
                      <li key={item.key} className={styles.attentionRow}>
                        <i
                          className={cn(styles.stripe, item.bad && styles.stripeBad)}
                          aria-hidden="true"
                        />
                        <div className={styles.attentionText}>
                          <b>{item.company}</b>
                          <span>{item.text}</span>
                        </div>
                        <Link className={styles.attentionLink} to={item.to}>
                          Review <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                    {attention.length === 0 && (
                      <li className={styles.attentionRow}>
                        <i className={cn(styles.stripe, styles.stripeGood)} aria-hidden="true" />
                        <div className={styles.attentionText}>
                          <b>Nothing outstanding</b>
                          <span>No drafts, no closed years, every company readable.</span>
                        </div>
                        <CircleCheck size={18} className={styles.good} aria-hidden="true" />
                      </li>
                    )}
                  </ul>
                </section>
              )}
            </div>
          )}

          <div className={styles.listHead}>
            <h2 className={styles.panelTitle}>Companies</h2>
            <span className={styles.panelSub}>Open one to work in its books</span>
          </div>

          <div className={styles.grid}>
            {companies.map((company, index) => (
              <div
                key={company.id}
                className={styles.card}
                style={{ '--i': index + 6 } as CSSProperties}
              >
                <div className={styles.cardHeader}>
                  <span
                    className={styles.chip}
                    style={{ background: companyAccent(company) }}
                    aria-hidden="true"
                  >
                    {companyInitials(company)}
                  </span>
                  <div className={styles.cardIdentity}>
                    <p className={styles.cardName}>{company.name}</p>
                    <p className={styles.cardMeta}>
                      {/*
                        Three companies of two kinds sit in this list. Without the type they are told
                        apart only by a code someone has to remember the meaning of.
                      */}
                      {companyTypeLabel(company.type)} · {company.baseCurrency} · {company.country}
                    </p>
                  </div>
                  <Badge variant={companyStatusVariant(company.status)}>{company.status}</Badge>
                </div>

                {renderFigures(figuresById.get(company.id), company)}

                <div className={styles.cardFooter}>
                  <span className={styles.cardCode}>{company.code}</span>
                  {/*
                    A real link, and — through .cardLink::after — one whose hit area is the whole
                    card, so a click anywhere on it opens the company rather than selecting text.
                  */}
                  <Link
                    to={`/companies/${company.id}`}
                    className={styles.cardLink}
                    aria-label={`Open ${company.name}`}
                  >
                    Open <ArrowRight size={14} />
                  </Link>
                  <div className={styles.cardActions}>
                    <IconButton
                      label={`Edit ${company.name}`}
                      onClick={() => setEditingCompany(company)}
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New company">
        <CreateCompanyForm onCreated={handleCreated} onCancel={() => setCreateModalOpen(false)} />
      </Modal>

      <Modal
        open={editingCompany !== null}
        onClose={() => setEditingCompany(null)}
        title="Edit company"
      >
        {editingCompany && (
          <EditCompanyForm
            company={editingCompany}
            onSaved={handleEdited}
            onCancel={() => setEditingCompany(null)}
          />
        )}
      </Modal>
    </div>
  );
}
