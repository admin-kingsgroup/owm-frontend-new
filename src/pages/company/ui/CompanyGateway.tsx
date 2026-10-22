import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  Coins,
  Files,
  FolderTree,
  Gem,
  Landmark,
  OctagonAlert,
  Plus,
  Scale,
  Settings2,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';

import type { Company } from '@/entities/company';
import { getForexGainLoss } from '@/entities/currency';
import type { ForexGainLossReport } from '@/entities/currency';
import { getPayables, getReceivables } from '@/entities/outstanding';
import type { AgeingBucket, OutstandingsReport } from '@/entities/outstanding';
import { getBalanceSheet, getCashFlow, getExceptions, getProfitAndLoss } from '@/entities/report';
import type {
  BalanceSheetReport,
  CashFlowReport,
  ExceptionReport,
  ProfitAndLossReport,
  ReportNode,
} from '@/entities/report';
import { listVouchers, voucherStatusVariant } from '@/entities/voucher';
import type { VoucherSummary } from '@/entities/voucher';
import { functionKeyFor, inFunctionKeyOrder } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';
import { cn, formatCalendarDay, formatCompactMoney, formatMoney, localeFor } from '@/shared/lib';
import {
  Badge,
  BarChart,
  ChartLegend,
  KpiTile,
  LineChart,
  Skeleton,
  StackedBars,
} from '@/shared/ui';
import { useCompanyReadout } from '@/widgets/app-shell';
import { DashboardHeader } from '@/widgets/dashboard-header';

import styles from './CompanyGateway.module.css';

interface CompanyGatewayProps {
  company: Company;
  voucherTypes: VoucherType[];
}

/**
 * Every report this screen reads.
 *
 * They are fetched together and settled independently: a dashboard is several answers side by
 * side, and one of them failing is worth one empty card, not an empty screen. Which ones are asked
 * for at all depends on the company's features — a company without bill-wise details has no
 * receivables to age, and asking would be a request that could only ever fail.
 */
interface Figures {
  balanceSheet: BalanceSheetReport | null;
  profitAndLoss: ProfitAndLossReport | null;
  cashFlow: CashFlowReport | null;
  exceptions: ExceptionReport | null;
  receivables: OutstandingsReport | null;
  payables: OutstandingsReport | null;
  forex: ForexGainLossReport | null;
  /** The newest vouchers, as the register answers them — newest first. */
  recent: VoucherSummary[] | null;
}

const NOTHING_READ: Figures = {
  balanceSheet: null,
  profitAndLoss: null,
  cashFlow: null,
  exceptions: null,
  receivables: null,
  payables: null,
  forex: null,
  recent: null,
};

/**
 * How many of the newest vouchers the dashboard shows.
 *
 * A page of the register, not the year. This card answers "what has been filed lately", which is a
 * glance; the Day Book answers "what was filed", which is a report and has a screen of its own.
 */
const RECENT_LIMIT = 8;

/** The ageing buckets in the order a person reads them, with the words the reports use. */
const AGEING: Array<{ bucket: AgeingBucket; label: string }> = [
  { bucket: 'NOT_DUE', label: 'Not due' },
  { bucket: '0_30', label: '1-30 days' },
  { bucket: '31_60', label: '31-60' },
  { bucket: '61_90', label: '61-90' },
  { bucket: 'OVER_90', label: 'Over 90' },
];

/**
 * The company dashboard: what this company is worth, where the money sits, how it moved, and what
 * is unfinished.
 *
 * It replaced a written-out menu. Tally opens on one, but every one of those destinations is now a
 * sidebar item or one search away (Ctrl+K), and the function-key strip raises the documents. A
 * third copy of the same list was the least valuable thing that could occupy the screen seen most
 * often, so the space went to the figures instead.
 *
 * Every figure is read from the reports the statements themselves are drawn from — nothing here is
 * computed a second way — so no tile can disagree with the statement one click behind it.
 */
export function CompanyGateway({ company, voucherTypes }: CompanyGatewayProps) {
  const base = `/companies/${company.id}`;

  const [figures, setFigures] = useState<Figures>(NOTHING_READ);
  const [loading, setLoading] = useState(true);
  /** The reports that could not be read, by name — said once, above, rather than card by card. */
  const [unread, setUnread] = useState<string[]>([]);

  /*
    The difference and the draft count come from the frame, which has already read them for the
    context strip. Asking again would be three more round trips for figures already on screen.
  */
  const { context } = useCompanyReadout();

  const { billWiseDetails, multiCurrency } = company.features;

  useEffect(() => {
    const id = company.id;
    let cancelled = false;
    const failures: string[] = [];

    /**
     * Records the failure and yields null, so the caller gets a settled value per report rather
     * than one rejection that takes the other six with it. The tile then draws its own absence —
     * never a zero, which would read as a real balance.
     */
    async function read<T>(name: string, request: Promise<T>): Promise<T | null> {
      try {
        return await request;
      } catch {
        failures.push(name);
        return null;
      }
    }

    async function load() {
      setLoading(true);
      /*
        Cleared before the first request, not merged into after the last.

        The screen above this one happens to unmount the dashboard while it moves between companies,
        which achieves the same thing — but that is its decision and not a promise, and the fault it
        would let through is the worst kind this product can produce: one company's balances drawn
        under another company's name, with nothing on screen saying so.
      */
      setFigures(NOTHING_READ);
      setUnread([]);

      const [
        balanceSheet,
        profitAndLoss,
        cashFlow,
        exceptions,
        receivables,
        payables,
        forex,
        register,
      ] = await Promise.all([
        read('Balance Sheet', getBalanceSheet(id)),
        read('Profit & Loss', getProfitAndLoss(id)),
        read('Cash Flow', getCashFlow(id)),
        read('Exceptions', getExceptions(id)),
        billWiseDetails ? read('Receivables', getReceivables(id)) : null,
        billWiseDetails ? read('Payables', getPayables(id)) : null,
        multiCurrency ? read('Forex Gain/Loss', getForexGainLoss(id)) : null,
        /* One page of the register, not the year: this is "what happened lately", not a report. */
        read('Recent vouchers', listVouchers(id, { limit: RECENT_LIMIT })),
      ]);

      if (cancelled) return;
      setFigures({
        balanceSheet,
        profitAndLoss,
        cashFlow,
        exceptions,
        receivables,
        payables,
        forex,
        recent: register?.items ?? null,
      });
      setUnread(failures);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [company.id, billWiseDetails, multiCurrency]);

  const {
    balanceSheet,
    profitAndLoss,
    cashFlow,
    exceptions,
    receivables,
    payables,
    forex,
    recent,
  } = figures;

  /**
   * How a figure is written on this screen.
   *
   * No currency symbol, matching the reports: the strip at the foot of the shell already says which
   * currency the figures are in, and repeating it on every row costs width the figures need. The
   * companies list keeps its symbols, because there the figures sit side by side in different
   * currencies.
   */
  const money = (value: string | number) => formatMoney(value, { country: company.country });
  /** The same, with an exact nil left blank — for the grids, which draw their own dot. */
  const gridMoney = (value: string) =>
    formatMoney(value, { country: company.country, blankZero: true });

  /** Month names the way this company writes dates. */
  const monthLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(localeFor(company.country), {
      month: 'short',
      timeZone: 'UTC',
    });
    return (month: string) => formatter.format(new Date(month));
  }, [company.country]);

  /**
   * Assets less liabilities. Taken from the statement's own totals rather than by adding the rows
   * up here, so the dashboard cannot drift from the balance sheet by a rounding step.
   */
  const netWorth = balanceSheet
    ? (Number(balanceSheet.totals.assets) - Number(balanceSheet.totals.liabilities)).toFixed(2)
    : null;

  /**
   * The last month the books actually moved in — not necessarily this one. Named for the month it
   * is, so a dashboard opened in a quiet August never labels July's figures as August's.
   */
  const latestMonth = cashFlow?.monthly.at(-1) ?? null;

  /**
   * The shape of the year behind a headline figure, for the tiles that have one.
   *
   * A running total rather than the month's own movement: the tile states a balance, and a line of
   * per-month changes beside a balance is a different quantity drawn as though it were the same
   * one. Cumulative, the line is the balance's own trajectory — which is what "is this going up"
   * means when you glance at it.
   *
   * Normalised to its own range by Sparkline, so it reads as a direction of travel and never as an
   * amount; the figure beside it is what carries the amount.
   */
  const runningTotal = (steps: number[]): number[] =>
    steps.reduce<number[]>((into, step) => [...into, (into.at(-1) ?? 0) + step], []);

  const cashTrend = cashFlow
    ? runningTotal(cashFlow.monthly.map((month) => Number(month.netChange)))
    : [];

  const profitTrend = profitAndLoss
    ? runningTotal(
        profitAndLoss.monthly.map((month) => Number(month.income) - Number(month.expenses)),
      )
    : [];

  /**
   * The company's own names for its voucher types, for the register rows below.
   *
   * A row names its type from this rather than printing the id it was stored against — an id says
   * nothing to a reader, and a type the company has since deleted has no name to give, in which
   * case the row shows nothing rather than a fragment of the database.
   */
  const typeNames = useMemo(
    () => new Map(voucherTypes.map((type) => [type.id, type.name])),
    [voucherTypes],
  );

  /*
    Only what is genuinely outstanding, and each fault reported once. The opening-balance difference
    is deliberately not a separate line: every posted voucher balances, so the trial balance
    difference *is* the opening difference. Two lines would report one fault twice, and disagree the
    moment one of them was read at a different time.
  */
  const drafts = context?.draftVouchers ?? null;
  /*
    Each item carries how bad it is as a word rather than as the class it will be drawn in. The
    band reads the severities to decide whether it is amber or red, and a decision made by
    comparing CSS-module class names is one that quietly changes meaning the moment two of them
    resolve alike.
  */
  const attention = [
    drafts && drafts > 0
      ? {
          key: 'drafts',
          label: `${drafts} draft ${drafts === 1 ? 'voucher' : 'vouchers'} awaiting post`,
          to: `${base}/vouchers?status=DRAFT`,
          severity: 'warn' as const,
        }
      : null,
    context && Number(context.difference) !== 0
      ? {
          key: 'difference',
          label: `Books out by ${money(context.difference)} — debits do not equal credits`,
          to: `${base}/reports?report=trial-balance`,
          severity: 'bad' as const,
        }
      : null,
    context?.period.financialYearStatus === 'CLOSED'
      ? {
          key: 'closed',
          label: `Financial year ${context.period.financialYearLabel} is closed to new vouchers`,
          to: `${base}?tab=financial-years`,
          severity: 'warn' as const,
        }
      : null,
    /*
      The exception report's own counts, not a re-derivation of them. Errors and warnings are kept
      apart because they are different claims — an error is something that is wrong, a warning is
      something worth a look — and one number loses which of the two you have.
    */
    exceptions && exceptions.totals.errors > 0
      ? {
          key: 'errors',
          label: `${exceptions.totals.errors} ${
            exceptions.totals.errors === 1 ? 'entry needs' : 'entries need'
          } correcting before signing`,
          to: `${base}/reports?report=exceptions`,
          severity: 'bad' as const,
        }
      : null,
    exceptions && exceptions.totals.warnings > 0
      ? {
          key: 'warnings',
          label: `${exceptions.totals.warnings} ${
            exceptions.totals.warnings === 1 ? 'entry is' : 'entries are'
          } worth a second look`,
          to: `${base}/reports?report=exceptions`,
          severity: 'warn' as const,
        }
      : null,
    /*
      A bill in a foreign currency whose closing rate is missing is not converted at all — it is
      left out of the gain and loss entirely. Silently, unless somebody says so here.
    */
    forex && forex.skippedForMissingRate.length > 0
      ? {
          key: 'rates',
          label: `${forex.skippedForMissingRate.length} bill${
            forex.skippedForMissingRate.length === 1 ? '' : 's'
          } left out of the gain and loss — no closing rate entered`,
          to: `${base}?tab=currencies`,
          severity: 'warn' as const,
        }
      : null,
  ].filter((item) => item !== null);

  /** Where a balance-sheet row's working actually lives — a group and an account differ. */
  const workingFor = (node: ReportNode) =>
    node.kind === 'ledger'
      ? `${base}/reports?report=ledger&ledgerId=${node.id}`
      : `${base}/reports?report=monthly-summary&groupId=${node.id}`;

  /** Short figures for chart axes — 12L, 1.2Cr — in this company's own units. */
  const axis = (value: number) => formatCompactMoney(value, { country: company.country });
  const moneyNumber = (value: number) => money(value);

  /**
   * The one document this dashboard offers to raise: the company's main document — Sales for a
   * business, Income for a household — and only if it is switched on. The full list is the key
   * strip's and the + on a phone; this is the shortcut to the commonest one.
   */
  const primary = useMemo(() => {
    const active = inFunctionKeyOrder(voucherTypes.filter((type) => type.isActive));
    return (
      active.find((type) => type.code === 'SALES' || type.code === 'INCOME') ??
      active.find((type) => type.code === 'RECEIPT') ??
      active[0] ??
      null
    );
  }, [voucherTypes]);
  const primaryKey = primary ? functionKeyFor(primary.code) : undefined;

  const balanced = context !== null && Number(context.difference) === 0;
  const tone = { warn: styles.chipWarn, bad: styles.chipBad } as const;

  return (
    <div className={styles.gateway}>
      <DashboardHeader
        company={company}
        kind="Company dashboard"
        asOn={balanceSheet?.period.to ?? null}
        period={context?.period.financialYearLabel ?? null}
        actions={
          <>
            <Link className={styles.action} to={`${base}/reports?report=day-book`}>
              <BookOpen size={15} aria-hidden="true" />
              Day Book <kbd className={styles.kbd}>Alt K</kbd>
            </Link>
            {primary && (
              <Link
                className={cn(styles.action, styles.actionPrimary)}
                to={`${base}/vouchers?new=${primary.code}`}
              >
                <Plus size={15} aria-hidden="true" />
                New {primary.name}
                {primaryKey && <kbd className={styles.kbd}>{primaryKey}</kbd>}
              </Link>
            )}
          </>
        }
      />

      {unread.length > 0 && (
        <p className={styles.notice} role="status">
          {unread.join(', ')} could not be read. Everything else on this page is current.
        </p>
      )}

      {/*
        What is outstanding, before anything it is outstanding about — each item a link to where it
        is fixed. The all-clear is said once, quietly, when there is nothing; never as a list that
        is always there and stops being read.
      */}
      <div className={styles.attention} aria-label="Needs attention">
        {attention.map((item) => (
          <Link className={cn(styles.chip, tone[item.severity])} key={item.key} to={item.to}>
            {item.severity === 'bad' ? (
              <OctagonAlert size={15} aria-hidden="true" />
            ) : (
              <TriangleAlert size={15} aria-hidden="true" />
            )}
            {item.label}
          </Link>
        ))}
        {attention.length === 0 && (
          <span className={cn(styles.chip, styles.chipGood)}>
            <CircleCheck size={15} aria-hidden="true" />
            {drafts === null && loading
              ? 'Checking…'
              : 'Nothing outstanding — the books are square.'}
          </span>
        )}
        {balanced && (
          <Link
            className={cn(styles.chip, styles.chipGood)}
            to={`${base}/reports?report=trial-balance`}
          >
            <Scale size={15} aria-hidden="true" />
            Books balanced · Dr = Cr
          </Link>
        )}
        {context && context.period.financialYearStatus === 'OPEN' && (
          <Link className={cn(styles.chip, styles.chipInfo)} to={`${base}?tab=financial-years`}>
            <CalendarRange size={15} aria-hidden="true" />
            FY {context.period.financialYearLabel} open for vouchers
          </Link>
        )}
      </div>

      {/*
        The four figures worth knowing before choosing where to go next. Each opens the statement it
        came from — a dashboard number nobody can question is a number nobody should trust.
      */}
      <div className={styles.kpis}>
        <KpiTile
          index={0}
          label="Net worth"
          icon={<Gem />}
          value={netWorth === null ? null : Number(netWorth)}
          loading={loading && netWorth === null}
          format={moneyNumber}
          negative={netWorth !== null && Number(netWorth) < 0}
          hint={
            balanceSheet &&
            `Assets ${money(balanceSheet.totals.assets)} · liabilities ${money(balanceSheet.totals.liabilities)}`
          }
          to={`${base}/reports?report=balance-sheet`}
        />
        <KpiTile
          index={1}
          label="Cash & bank"
          icon={<Landmark />}
          value={cashFlow ? Number(cashFlow.closingBalance) : null}
          loading={loading && !cashFlow}
          format={moneyNumber}
          suffix={cashFlow ? (cashFlow.closingSide === 'DEBIT' ? 'Dr' : 'Cr') : undefined}
          hint={
            cashFlow &&
            `${Number(cashFlow.totals.netChange) < 0 ? 'Down' : 'Up'} ${money(Math.abs(Number(cashFlow.totals.netChange)))} over the year`
          }
          trend={cashTrend}
          trendLabels={cashFlow?.monthly.map((month) => monthLabel(month.month))}
          trendColor="var(--series-1)"
          to={`${base}/reports?report=cash-flow`}
        />
        <KpiTile
          index={2}
          label="Net profit"
          icon={<TrendingUp />}
          value={profitAndLoss ? Number(profitAndLoss.totals.netProfit) : null}
          loading={loading && !profitAndLoss}
          format={moneyNumber}
          negative={profitAndLoss !== null && Number(profitAndLoss.totals.netProfit) < 0}
          hint={
            profitAndLoss &&
            `Income ${money(profitAndLoss.totals.income)} · expenses ${money(profitAndLoss.totals.expenses)}`
          }
          trend={profitTrend}
          trendLabels={profitAndLoss?.monthly.map((month) => monthLabel(month.month))}
          trendColor="var(--series-4)"
          to={`${base}/reports?report=profit-loss`}
        />
        {/* The last month anything moved, named for the month it is — see latestMonth. */}
        <KpiTile
          index={3}
          label={latestMonth ? monthLabel(latestMonth.month) : 'Latest month'}
          icon={<CalendarDays />}
          value={latestMonth ? Number(latestMonth.netChange) : null}
          loading={loading && !latestMonth}
          format={moneyNumber}
          negative={latestMonth !== null && Number(latestMonth.netChange) < 0}
          hint={
            latestMonth && `In ${money(latestMonth.inflow)} · out ${money(latestMonth.outflow)}`
          }
          to={`${base}/reports?report=receipts-payments`}
        />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          {/* Only where there is a period to plot. One month is a bar, not a shape. */}
          {cashFlow && cashFlow.monthly.length > 1 && (
            <section className={styles.card} style={{ '--i': 4 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Cash, month by month</h2>
                <span className={styles.cardSub}>in and out of cash and bank</span>
                <ChartLegend
                  className={styles.cardRight}
                  items={[
                    { label: 'Cash in', color: 'var(--series-1)' },
                    { label: 'Cash out', color: 'var(--series-2)' },
                  ]}
                />
              </div>
              <BarChart
                labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
                series={[
                  {
                    label: 'Cash in',
                    color: 'var(--series-1)',
                    values: cashFlow.monthly.map((month) => Number(month.inflow)),
                  },
                  {
                    label: 'Cash out',
                    color: 'var(--series-2)',
                    values: cashFlow.monthly.map((month) => Number(month.outflow)),
                  },
                ]}
                formatValue={moneyNumber}
                formatAxis={axis}
                footer={(i) => ({
                  color: 'transparent',
                  label: 'Net',
                  value: money(cashFlow.monthly[i].netChange),
                })}
                caption="Cash in and cash out for each month of the year so far"
              />
            </section>
          )}

          {profitAndLoss && profitAndLoss.monthly.length > 1 && (
            <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Income &amp; expense, month by month</h2>
                <ChartLegend
                  className={styles.cardRight}
                  items={[
                    { label: 'Income', color: 'var(--series-1)', line: true },
                    { label: 'Expenses', color: 'var(--series-2)', line: true },
                  ]}
                />
              </div>
              <LineChart
                area
                labels={profitAndLoss.monthly.map((month) => monthLabel(month.month))}
                series={[
                  {
                    label: 'Income',
                    color: 'var(--series-1)',
                    values: profitAndLoss.monthly.map((month) => Number(month.income)),
                  },
                  {
                    label: 'Expenses',
                    color: 'var(--series-2)',
                    values: profitAndLoss.monthly.map((month) => Number(month.expenses)),
                  },
                ]}
                formatValue={moneyNumber}
                formatAxis={axis}
                caption="Income and expenses for each month of the year so far"
              />
            </section>
          )}

          <section className={styles.card} style={{ '--i': 6 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Recently filed</h2>
              <Link className={cn(styles.more, styles.cardRight)} to={`${base}/vouchers`}>
                All vouchers <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>

            {recent === null &&
              (loading ? (
                <Skeleton lines={5} label="Reading the register…" />
              ) : (
                <p className={styles.pending}>The register could not be read.</p>
              ))}

            {recent !== null && recent.length === 0 && (
              <p className={styles.clear}>Nothing has been filed in this company yet.</p>
            )}

            {recent !== null && recent.length > 0 && (
              /* A record list, which data-stack turns into cards on a phone. */
              <table className={styles.figures} data-stack>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher</th>
                    <th>Type</th>
                    <th className={styles.amount}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((voucher, index) => (
                    <tr
                      key={voucher.id}
                      className={styles.figureRow}
                      style={{ '--i': index } as CSSProperties}
                    >
                      <td className={styles.recentDate} data-label="Date">
                        {formatCalendarDay(voucher.voucherDate, company.country)}
                      </td>
                      <td data-label="Voucher">
                        <span className={styles.recentNumber}>{voucher.voucherNumber}</span>
                        {voucher.narration && (
                          <span className={styles.recentNarration}>{voucher.narration}</span>
                        )}
                      </td>
                      {/* Named from the company's own types — blank where the type is gone. */}
                      <td className={styles.recentType} data-label="Type">
                        {typeNames.get(voucher.voucherTypeId) ?? ''}
                      </td>
                      <td className={styles.amount} data-label="Amount">
                        {gridMoney(voucher.amount)}
                      </td>
                      <td data-label="Status">
                        <Badge variant={voucherStatusVariant(voucher.status)}>
                          {voucher.status.toLowerCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card} style={{ '--i': 5 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Where the money is</h2>
              {balanceSheet && (
                <span className={styles.cardSub}>
                  {money(balanceSheet.totals.assets)} in assets
                </span>
              )}
            </div>

            {!balanceSheet &&
              (loading ? (
                <Skeleton lines={6} label="Reading the books…" />
              ) : (
                <p className={styles.pending}>The balance sheet could not be read.</p>
              ))}

            {/*
              The statement's own top-level groups, in its own order and under its own two headings,
              each with Dr or Cr and a bar for its share of that side — which is what "where is the
              money" is really asking. Every name opens the working behind it.
            */}
            {balanceSheet &&
              [
                {
                  heading: 'Assets',
                  nodes: balanceSheet.assets,
                  total: balanceSheet.totals.assets,
                },
                {
                  heading: 'Liabilities',
                  nodes: balanceSheet.liabilities,
                  total: balanceSheet.totals.liabilities,
                },
              ].map((section) => {
                const total = Math.abs(Number(section.total));
                return (
                  <div className={styles.moneySection} key={section.heading}>
                    <h3 className={styles.moneyHeading}>{section.heading}</h3>
                    {section.nodes.length === 0 && <p className={styles.clear}>None</p>}
                    {section.nodes.map((node, index) => {
                      const share = total > 0 ? Math.abs(Number(node.balance)) / total : 0;
                      const figure = gridMoney(node.balance);
                      return (
                        <div className={styles.moneyRow} key={node.id}>
                          <div className={styles.moneyLine}>
                            <Link className={styles.moneyName} to={workingFor(node)}>
                              {node.name}
                            </Link>
                            <span className={styles.moneyAmount}>
                              {figure ? (
                                <>
                                  {figure}{' '}
                                  <span className={styles.side}>
                                    {node.balanceSide === 'DEBIT' ? 'Dr' : 'Cr'}
                                  </span>
                                </>
                              ) : (
                                /* Nil: the side has nothing left to qualify. */
                                <span className={styles.nil}>·</span>
                              )}
                            </span>
                          </div>
                          {share > 0 && (
                            <span className={styles.shareTrack} aria-hidden="true">
                              <span
                                className={styles.shareFill}
                                style={
                                  {
                                    width: `${(share * 100).toFixed(1)}%`,
                                    '--i': index,
                                  } as CSSProperties
                                }
                              />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
          </section>

          {/*
            Only for a company that keeps bills against its parties. Without bill-wise details there
            is nothing to age, and an empty card would read as "nothing overdue".
          */}
          {billWiseDetails && (receivables !== null || payables !== null) && (
            <section className={styles.card} style={{ '--i': 6 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Owed to us, owed by us</h2>
                <span className={styles.cardSub}>by age of bill</span>
              </div>
              <StackedBars
                buckets={AGEING.map((row) => row.label)}
                rows={[
                  ...(receivables
                    ? [
                        {
                          label: 'Receivable',
                          to: `${base}/reports?report=receivables`,
                          parts: AGEING.map((row) =>
                            Number(receivables.totals.byBucket[row.bucket] ?? 0),
                          ),
                        },
                      ]
                    : []),
                  ...(payables
                    ? [
                        {
                          label: 'Payable',
                          to: `${base}/reports?report=payables`,
                          parts: AGEING.map((row) =>
                            Number(payables.totals.byBucket[row.bucket] ?? 0),
                          ),
                        },
                      ]
                    : []),
                ]}
                formatValue={moneyNumber}
              />
              <dl className={styles.outstanding}>
                <div>
                  <dt>Owed to us</dt>
                  <dd>{receivables ? money(receivables.totals.outstanding) : '—'}</dd>
                </div>
                <div>
                  <dt>Owed by us</dt>
                  <dd>{payables ? money(payables.totals.outstanding) : '—'}</dd>
                </div>
              </dl>
            </section>
          )}

          {/*
            What the foreign balances have done since they were booked — realised on bills settled,
            unrealised on those still open. A bill with no closing rate is named above, not folded in.
          */}
          {multiCurrency && forex && (
            <section className={styles.card} style={{ '--i': 7 } as CSSProperties}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Currency exposure</h2>
                <Link
                  className={cn(styles.more, styles.cardRight)}
                  to={`${base}/reports?report=forex`}
                >
                  Forex report <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <dl className={styles.outstanding}>
                <div>
                  <dt>Realised gain or loss</dt>
                  <dd>{money(forex.totals.realised)}</dd>
                </div>
                <div>
                  <dt>Unrealised, on bills still open</dt>
                  <dd>{money(forex.totals.unrealised)}</dd>
                </div>
                <div className={styles.outstandingTotal}>
                  <dt>Unadjusted</dt>
                  <dd>{money(forex.totals.unadjusted)}</dd>
                </div>
              </dl>
            </section>
          )}

          {/*
            The master screens, for someone who does not yet know which one they want. Unlike the
            voucher types these have no function key, so nothing else on screen is offering them.
          */}
          <section className={styles.card} style={{ '--i': 8 } as CSSProperties}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Masters</h2>
            </div>
            <div className={styles.masters}>
              <Link className={styles.master} to={`${base}?tab=accounts`}>
                <FolderTree size={17} aria-hidden="true" />
                <span>Groups &amp; ledgers — chart of accounts</span>
              </Link>
              <Link className={styles.master} to={`${base}?tab=parties`}>
                <Users size={17} aria-hidden="true" />
                <span>Parties — customers &amp; suppliers</span>
              </Link>
              <Link className={styles.master} to={`${base}?tab=voucher-types`}>
                <Files size={17} aria-hidden="true" />
                <span>Voucher types &amp; numbering</span>
                <span className={styles.count}>{voucherTypes.length}</span>
              </Link>
              {multiCurrency && (
                <Link className={styles.master} to={`${base}?tab=currencies`}>
                  <Coins size={17} aria-hidden="true" />
                  <span>Currencies &amp; rates</span>
                </Link>
              )}
              <Link className={styles.master} to={`${base}?tab=financial-years`}>
                <CalendarRange size={17} aria-hidden="true" />
                <span>Financial years</span>
              </Link>
              <Link className={styles.master} to={`${base}?tab=settings`}>
                <Settings2 size={17} aria-hidden="true" />
                <span>Features &amp; settings</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
