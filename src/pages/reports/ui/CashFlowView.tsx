import type { CashFlowReport, ReportNode } from '@/entities/report';
import { BarChart, ChartLegend, Waterfall } from '@/shared/ui';
import { formatCompactMoney } from '@/shared/lib';
import { cn } from '@/shared/lib';

import { MonthlyFigures } from './MonthlyFigures';
import { ReportTree } from './ReportTree';
import styles from './ReportsPage.module.css';

interface CashFlowViewProps {
  report: CashFlowReport;
  /**
   * Formats an amount the way the company writes money.
   *
   * Takes a number as well as a string because the chart hands it one: the figures arrive from the
   * server as decimal strings and are parsed only to be plotted.
   */
  money: (value: string | number) => string;
  /** Writes a month the way the company writes dates. */
  monthLabel: (month: string) => string;
  /** Opens the ledger behind a row. */
  openLedger: (node: ReportNode) => void;
  /** A figure in full, nil included — for the tiles. */
  figure: (value: string | number) => string;
  /** The company's country, for the chart's short axis figures. */
  country?: string;
}

/**
 * Where cash came from and where it went, month by month and then by group.
 *
 * Cash basis throughout, which is why it disagrees with the Profit & Loss for anyone selling on
 * credit — both are right, and they answer different questions.
 */
export function CashFlowView({
  report: cashFlow,
  money,
  monthLabel,
  openLedger,
  figure,
  country,
}: CashFlowViewProps) {
  const axis = (value: number) => formatCompactMoney(value, { country });
  /*
    Balances as the statement states them: debit is money held. A credit balance on cash and bank
    is an overdraft, and is drawn below the axis rather than as money.
  */
  const signed = (amount: string, side: string) =>
    side === 'CREDIT' ? -Number(amount) : Number(amount);
  const net = cashFlow.comparison ? `Net · FY ${cashFlow.period.financialYearLabel}` : 'Net';
  const priorNet = cashFlow.comparison ? `Net · FY ${cashFlow.comparison.financialYearLabel}` : '';

  return (
    <>
      {/* From the cash the period opened with to the cash it closed with: what came in, what went. */}
      <section className={styles.chartPanel}>
        <div className={styles.chartHead}>
          <h2 className={styles.chartTitle}>From opening cash to closing cash</h2>
          <ChartLegend
            items={[
              { label: 'Adds', color: 'var(--series-1)' },
              { label: 'Takes away', color: 'var(--series-negative)' },
              { label: 'Balance', color: 'var(--ink-faint)' },
            ]}
          />
        </div>
        <Waterfall
          steps={[
            {
              label: 'Opening',
              value: signed(cashFlow.openingBalance, cashFlow.openingSide),
              total: true,
            },
            {
              label: 'Cash in',
              value: Number(cashFlow.totals.inflow),
              note: 'everything received',
            },
            { label: 'Cash out', value: -Number(cashFlow.totals.outflow), note: 'everything paid' },
            {
              label: 'Closing',
              value: signed(cashFlow.closingBalance, cashFlow.closingSide),
              total: true,
            },
          ]}
          formatValue={figure}
          formatAxis={axis}
          caption="The opening cash and bank balance, what came in, what went out, and the closing balance"
        />
      </section>

      {cashFlow.monthly.length > 1 && (
        <section className={styles.chartPanel}>
          <div className={styles.chartHead}>
            <h2 className={styles.chartTitle}>Month by month</h2>
            <ChartLegend
              items={[
                { label: 'Cash in', color: 'var(--series-1)' },
                { label: 'Cash out', color: 'var(--series-2)' },
                { label: net, color: 'var(--series-3)' },
                ...(priorNet ? [{ label: priorNet, color: 'var(--series-4)' }] : []),
              ]}
            />
          </div>
          <BarChart
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            formatValue={figure}
            formatAxis={axis}
            caption={
              cashFlow.comparison
                ? `Cash in, cash out and the net change each month, against the net change of FY ${cashFlow.comparison.financialYearLabel}`
                : 'Cash in, cash out and the net change for each month of the period'
            }
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
              {
                label: net,
                color: 'var(--series-3)',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
              ...(cashFlow.comparison
                ? [
                    {
                      label: priorNet,
                      color: 'var(--series-4)',
                      values: cashFlow.monthly.map((month) => Number(month.priorNetChange ?? 0)),
                    },
                  ]
                : []),
            ]}
          />
          <MonthlyFigures
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            format={money}
            series={[
              {
                label: 'Cash in',
                values: cashFlow.monthly.map((month) => Number(month.inflow)),
              },
              {
                label: 'Cash out',
                values: cashFlow.monthly.map((month) => Number(month.outflow)),
              },
              {
                label: cashFlow.comparison
                  ? `Net · FY ${cashFlow.period.financialYearLabel}`
                  : 'Net',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
              ...(cashFlow.comparison
                ? [
                    {
                      label: `Net · FY ${cashFlow.comparison.financialYearLabel}`,
                      values: cashFlow.monthly.map((month) =>
                        month.priorNetChange === undefined ? null : Number(month.priorNetChange),
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>
      )}

      <>
        <div className={styles.buckets}>
          <div className={styles.bucket}>
            <span className={styles.bucketLabel}>Opening</span>
            <span className={styles.bucketAmount}>{money(cashFlow.openingBalance)}</span>
          </div>
          <div className={styles.bucket}>
            <span className={styles.bucketLabel}>Net change</span>
            <span className={styles.bucketAmount}>{money(cashFlow.totals.netChange)}</span>
          </div>
          <div className={cn(styles.bucket, styles.bucketTotal)}>
            <span className={styles.bucketLabel}>Closing</span>
            <span className={styles.bucketAmount}>{money(cashFlow.closingBalance)}</span>
          </div>
        </div>

        <div className={styles.twoColumn}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Cash in <span className={styles.panelTotal}>{money(cashFlow.totals.inflow)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={cashFlow.inflow}
              onSelectLedger={openLedger}
              showPrior={Boolean(cashFlow.comparison)}
            />
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>
              Cash out <span className={styles.panelTotal}>{money(cashFlow.totals.outflow)}</span>
            </h2>
            <ReportTree
              formatAmount={money}
              nodes={cashFlow.outflow}
              onSelectLedger={openLedger}
              showPrior={Boolean(cashFlow.comparison)}
            />
          </section>
        </div>
      </>
    </>
  );
}
