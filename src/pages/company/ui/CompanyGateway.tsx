import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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
import { listVouchers } from '@/entities/voucher';
import type { VoucherSummary } from '@/entities/voucher';
import type { VoucherType } from '@/entities/voucher-type';
import { cn, formatMoney, localeFor } from '@/shared/lib';
import { ColumnChart } from '@/shared/ui';
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
 * It replaced a written-out menu. Tally opens on one, and that reasoning held while the menu bar
 * was the only navigation in the product — but the bar now carries every one of those destinations
 * under Dashboards, Company, Masters, Transactions and Reports, and the function-key strip carries
 * the rest. A third copy of the same list was the least valuable thing that could occupy the screen
 * seen most often, so the space went to the figures instead.
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
  const attention = [
    drafts && drafts > 0
      ? {
          key: 'drafts',
          label: `${drafts} draft ${drafts === 1 ? 'voucher' : 'vouchers'} awaiting post`,
          to: `${base}/vouchers?status=DRAFT`,
          tone: styles.warn,
        }
      : null,
    context && Number(context.difference) !== 0
      ? {
          key: 'difference',
          label: `Books out by ${money(context.difference)} — debits do not equal credits`,
          to: `${base}/reports?report=trial-balance`,
          tone: styles.bad,
        }
      : null,
    context?.period.financialYearStatus === 'CLOSED'
      ? {
          key: 'closed',
          label: `Financial year ${context.period.financialYearLabel} is closed to new vouchers`,
          to: `${base}?tab=financial-years`,
          tone: styles.warn,
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
          tone: styles.bad,
        }
      : null,
    exceptions && exceptions.totals.warnings > 0
      ? {
          key: 'warnings',
          label: `${exceptions.totals.warnings} ${
            exceptions.totals.warnings === 1 ? 'entry is' : 'entries are'
          } worth a second look`,
          to: `${base}/reports?report=exceptions`,
          tone: styles.warn,
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
          tone: styles.warn,
        }
      : null,
  ].filter((item) => item !== null);

  /** Where a balance-sheet row's working actually lives — a group and an account differ. */
  const workingFor = (node: ReportNode) =>
    node.kind === 'ledger'
      ? `${base}/reports?report=ledger&ledgerId=${node.id}`
      : `${base}/reports?report=monthly-summary&groupId=${node.id}`;

  return (
    <div className={styles.gateway}>
      {/*
        No actions on the header. Raising a voucher belongs to the function-key strip, which is on
        screen everywhere rather than only here — listing the types again on this one screen was the
        same menu printed twice on one page, and it taught that data entry starts by coming back to
        the dashboard.
      */}
      <DashboardHeader
        company={company}
        kind="Company dashboard"
        asOn={balanceSheet?.period.to ?? null}
      />

      {unread.length > 0 && (
        <p className={styles.notice} role="status">
          {unread.join(', ')} could not be read. Everything else on this page is current.
        </p>
      )}

      {/*
        The four figures worth knowing before choosing where to go next. Each opens the statement it
        came from — a dashboard number nobody can question is a number nobody should trust.
      */}
      <div className={styles.kpis}>
        <Link className={styles.kpi} to={`${base}/reports?report=balance-sheet`}>
          <span className={styles.kpiLabel}>Net worth</span>
          <span className={styles.kpiValue}>
            {netWorth === null ? <span className={styles.nil}>—</span> : money(netWorth)}
          </span>
          {balanceSheet && (
            <span className={styles.kpiHint}>
              Assets {money(balanceSheet.totals.assets)} · liabilities{' '}
              {money(balanceSheet.totals.liabilities)}
            </span>
          )}
        </Link>

        <Link className={styles.kpi} to={`${base}/reports?report=cash-flow`}>
          <span className={styles.kpiLabel}>Cash &amp; bank</span>
          <span className={styles.kpiValue}>
            {cashFlow ? (
              <>
                {money(cashFlow.closingBalance)}{' '}
                <span className={styles.side}>
                  {cashFlow.closingSide === 'DEBIT' ? 'Dr' : 'Cr'}
                </span>
              </>
            ) : (
              <span className={styles.nil}>—</span>
            )}
          </span>
          {cashFlow && (
            <span className={styles.kpiHint}>
              {Number(cashFlow.totals.netChange) < 0 ? 'Down' : 'Up'}{' '}
              {money(Math.abs(Number(cashFlow.totals.netChange)))} over the year
            </span>
          )}
        </Link>

        <Link className={styles.kpi} to={`${base}/reports?report=profit-loss`}>
          <span className={styles.kpiLabel}>Net profit</span>
          <span
            className={cn(
              styles.kpiValue,
              profitAndLoss !== null &&
                Number(profitAndLoss.totals.netProfit) < 0 &&
                styles.kpiNegative,
            )}
          >
            {profitAndLoss ? (
              money(profitAndLoss.totals.netProfit)
            ) : (
              <span className={styles.nil}>—</span>
            )}
          </span>
          {profitAndLoss && (
            <span className={styles.kpiHint}>
              Income {money(profitAndLoss.totals.income)} · expenses{' '}
              {money(profitAndLoss.totals.expenses)}
            </span>
          )}
        </Link>

        <Link className={styles.kpi} to={`${base}/reports?report=receipts-payments`}>
          {/* The last month anything moved, named for the month it is — see latestMonth. */}
          <span className={styles.kpiLabel}>
            {latestMonth ? monthLabel(latestMonth.month) : 'Latest month'}
          </span>
          <span className={styles.kpiValue}>
            {latestMonth ? money(latestMonth.netChange) : <span className={styles.nil}>—</span>}
          </span>
          {latestMonth && (
            <span className={styles.kpiHint}>
              In {money(latestMonth.inflow)} · out {money(latestMonth.outflow)}
            </span>
          )}
        </Link>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Where the money is</h2>

            {!balanceSheet && (
              <p className={styles.pending}>
                {loading ? 'Reading the books…' : 'The balance sheet could not be read.'}
              </p>
            )}

            {balanceSheet && (
              <table className={styles.figures}>
                {/*
                  The statement's own top-level groups, in its own order and under its own two
                  headings — nothing is named here, so a company with a different chart of accounts
                  still reads correctly. Without the headings the two lists ran together and the
                  only thing separating a holding from a debt was the sign in front of it.

                  Each figure carries Dr or Cr, the way the statements themselves show it, and a bar
                  showing its share of that side — which is what "where is the money" is really
                  asking, and the question a column of figures answers slowest.
                */}
                {[
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
                    <tbody key={section.heading}>
                      <tr>
                        <th scope="colgroup" colSpan={3} className={styles.figuresHeading}>
                          {section.heading}
                        </th>
                      </tr>
                      {section.nodes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className={styles.figuresEmpty}>
                            None
                          </td>
                        </tr>
                      ) : (
                        section.nodes.map((node) => {
                          /* Nil over nil is not a share, and an unmeasurable one draws nothing. */
                          const share = total > 0 ? Math.abs(Number(node.balance)) / total : 0;

                          return (
                            <tr key={node.id} className={styles.figureRow}>
                              {/*
                                Every other figure in this product opens the working behind it, and
                                these were once the exception — the one place a reader could see a
                                number they wanted to question and had to go and find the report
                                themselves.

                                The link sits on the name rather than the amount: it is the reliable
                                place to click, it reads as a link, and it keeps the amount column
                                scanning as a column of figures.
                              */}
                              <td>
                                <Link className={styles.figureLink} to={workingFor(node)}>
                                  {node.name}
                                </Link>
                              </td>
                              <td className={styles.amount}>
                                {gridMoney(node.balance) ? (
                                  <>
                                    {gridMoney(node.balance)}{' '}
                                    <span className={styles.side}>
                                      {node.balanceSide === 'DEBIT' ? 'Dr' : 'Cr'}
                                    </span>
                                  </>
                                ) : (
                                  /* Nil. The side has nothing left to qualify, and printed anyway
                                     it reads as a figure that failed to load rather than as a group
                                     holding nothing. */
                                  <span className={styles.nil}>·</span>
                                )}
                              </td>
                              <td className={styles.shareCell}>
                                {/*
                                  Nothing at all for a group holding nothing. An empty track drawn
                                  for every nil row was six grey pills down a chart of accounts,
                                  which reads as six bars that failed to load rather than as six
                                  accounts with no share of anything.

                                  Decoration over a figure already stated beside it, so what is
                                  drawn is hidden from the accessibility tree rather than read out
                                  as a second, vaguer version of the same number.
                                */}
                                {share > 0 && (
                                  <span className={styles.shareTrack} aria-hidden="true">
                                    <span
                                      className={styles.shareFill}
                                      style={{ width: `${(share * 100).toFixed(1)}%` }}
                                    />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  );
                })}
                {/*
                  No net-worth footing here. The figure sits in the tile directly above this card,
                  and stating it twice within one screen invites the reading that they are two
                  different numbers — which is precisely what a reader would assume of a total that
                  disagreed by a rounding step.
                */}
              </table>
            )}
          </section>

          {/*
            Only where there is a period to plot. One month is a bar, not a shape, and a chart of it
            says less than the figure already above it.
          */}
          {cashFlow && cashFlow.monthly.length > 1 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Cash, month by month</h2>
              <div className={styles.chartBody}>
                <ColumnChart
                  labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
                  formatValue={money}
                  scaleLabel={money}
                  caption="Cash in and cash out for each month of the year so far"
                  series={[
                    {
                      label: 'Cash in',
                      color: 'var(--data-1)',
                      values: cashFlow.monthly.map((month) => Number(month.inflow)),
                    },
                    {
                      label: 'Cash out',
                      color: 'var(--data-2)',
                      values: cashFlow.monthly.map((month) => Number(month.outflow)),
                    },
                  ]}
                />
              </div>
            </section>
          )}
          {/*
            The five master screens. The menu bar reaches every one of them, but this is the list a
            person scans when they do not yet know which one they want — and unlike the voucher
            types above, these have no function key, so the bar is not already offering them.
          */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Masters</h2>
            <Link className={styles.item} to={`${base}?tab=accounts`}>
              <span>Groups &amp; ledgers — chart of accounts</span>
            </Link>
            <Link className={styles.item} to={`${base}?tab=parties`}>
              <span>Parties — customers &amp; suppliers</span>
            </Link>
            <Link className={styles.item} to={`${base}?tab=voucher-types`}>
              <span>Voucher types &amp; numbering</span>
              <span className={styles.count}>{voucherTypes.length}</span>
            </Link>
            {multiCurrency && (
              <Link className={styles.item} to={`${base}?tab=currencies`}>
                <span>Currencies &amp; rates</span>
              </Link>
            )}
            <Link className={styles.item} to={`${base}?tab=financial-years`}>
              <span>Financial years</span>
            </Link>
            <Link className={styles.item} to={`${base}?tab=settings`}>
              <span>Features &amp; settings</span>
            </Link>
          </section>
        </div>

        <div className={styles.column}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Needs attention</h2>
            {attention.length === 0 ? (
              <p className={styles.clear}>
                {drafts === null && loading
                  ? 'Checking…'
                  : 'Nothing outstanding — the books are square.'}
              </p>
            ) : (
              attention.map((item) => (
                <Link className={styles.item} key={item.key} to={item.to}>
                  <span className={item.tone}>{item.label}</span>
                </Link>
              ))
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Recently filed</h2>

            {recent === null && (
              <p className={styles.pending}>
                {loading ? 'Reading the register…' : 'The register could not be read.'}
              </p>
            )}

            {recent !== null && recent.length === 0 && (
              <p className={styles.clear}>Nothing has been filed in this company yet.</p>
            )}

            {recent !== null && recent.length > 0 && (
              <table className={styles.figures}>
                {/*
                  Headed for a reader who cannot see the shape of it. The columns are obvious by
                  eye — a number, what it was for, a type, an amount — and naming them on screen
                  would cost a third of the card's height to say what it already says.
                */}
                <thead className={styles.srOnly}>
                  <tr>
                    <th>Voucher</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((voucher) => (
                    <tr key={voucher.id} className={styles.figureRow}>
                      <td>
                        <span className={styles.recentNumber}>{voucher.voucherNumber}</span>
                        {voucher.narration && (
                          <span className={styles.recentNarration}>{voucher.narration}</span>
                        )}
                      </td>
                      {/*
                        Named from the company's own types — see typeNames. Blank where the type has
                        since been deleted, rather than the id it was stored against.
                      */}
                      <td className={styles.recentType}>
                        {typeNames.get(voucher.voucherTypeId) ?? ''}
                      </td>
                      <td className={styles.amount}>{gridMoney(voucher.amount)}</td>
                      <td>
                        {/*
                          Posted is the ordinary case and goes unmarked; a draft is the one worth
                          seeing, because it is in the books' totals nowhere.
                        */}
                        {voucher.status !== 'POSTED' && (
                          <span className={styles.recentStatus}>
                            {voucher.status.toLowerCase()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row" colSpan={4}>
                      <Link className={styles.figureLink} to={`${base}/vouchers`}>
                        All vouchers
                      </Link>
                    </th>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          {profitAndLoss && profitAndLoss.monthly.length > 1 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Income &amp; expense, month by month</h2>
              <div className={styles.chartBody}>
                <ColumnChart
                  labels={profitAndLoss.monthly.map((month) => monthLabel(month.month))}
                  formatValue={money}
                  scaleLabel={money}
                  caption="Income and expenses for each month of the year so far"
                  series={[
                    {
                      label: 'Income',
                      color: 'var(--data-1)',
                      values: profitAndLoss.monthly.map((month) => Number(month.income)),
                    },
                    {
                      label: 'Expenses',
                      color: 'var(--data-2)',
                      values: profitAndLoss.monthly.map((month) => Number(month.expenses)),
                    },
                  ]}
                />
              </div>
            </section>
          )}

          {/*
            Only for a company that keeps bills against its parties. Without bill-wise details there
            is nothing to age, and an empty ageing card would read as "nothing overdue" rather than
            as "this company does not track that".
          */}
          {billWiseDetails && (receivables !== null || payables !== null) && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Owed to us, owed by us</h2>
              <table className={styles.figures}>
                <thead>
                  <tr>
                    <th className={styles.figuresHeading}>Ageing</th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>Receivable</th>
                    <th className={cn(styles.figuresHeading, styles.amount)}>Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {AGEING.map((row) => (
                    <tr key={row.bucket} className={styles.figureRow}>
                      <td>{row.label}</td>
                      <td className={styles.amount}>
                        {gridMoney(receivables?.totals.byBucket[row.bucket] ?? '0') || (
                          <span className={styles.nil}>·</span>
                        )}
                      </td>
                      <td className={styles.amount}>
                        {gridMoney(payables?.totals.byBucket[row.bucket] ?? '0') || (
                          <span className={styles.nil}>·</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row">
                      <Link className={styles.figureLink} to={`${base}/reports?report=receivables`}>
                        Outstanding
                      </Link>
                    </th>
                    <td className={styles.amount}>
                      {receivables ? money(receivables.totals.outstanding) : '—'}
                    </td>
                    <td className={styles.amount}>
                      {payables ? money(payables.totals.outstanding) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          {/*
            Only for a company that keeps more than one currency. What the foreign balances have
            done since they were booked — realised on bills already settled, unrealised on those
            still open, and the part no rate could be found for, which is stated above rather than
            folded into either.
          */}
          {multiCurrency && forex && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Currency exposure</h2>
              <table className={styles.figures}>
                <tbody>
                  <tr className={styles.figureRow}>
                    <td>
                      <Link className={styles.figureLink} to={`${base}/reports?report=forex`}>
                        Realised gain or loss
                      </Link>
                    </td>
                    <td className={styles.amount}>{money(forex.totals.realised)}</td>
                  </tr>
                  <tr className={styles.figureRow}>
                    <td>
                      <Link className={styles.figureLink} to={`${base}/reports?report=forex`}>
                        Unrealised, on bills still open
                      </Link>
                    </td>
                    <td className={styles.amount}>{money(forex.totals.unrealised)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row">Unadjusted</th>
                    <td className={styles.amount}>{money(forex.totals.unadjusted)}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
