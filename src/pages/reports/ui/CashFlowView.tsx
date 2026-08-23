import type { CashFlowReport, ReportNode } from '@/entities/report';
import { ColumnChart } from '@/shared/ui';
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
}: CashFlowViewProps) {
  return (
    <>
      {cashFlow.monthly.length > 1 && (
        <section className={styles.chartPanel}>
          <h2 className={styles.chartTitle}>Month by month</h2>
          <ColumnChart
            labels={cashFlow.monthly.map((month) => monthLabel(month.month))}
            formatValue={money}
            scaleLabel={money}
            caption={
              cashFlow.comparison
                ? `Cash in, cash out and the net change each month, against the net change of FY ${cashFlow.comparison.financialYearLabel}`
                : 'Cash in, cash out and the net change for each month of the period'
            }
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
              {
                /* Named for its year only while there are two of them on the plot. */
                label: cashFlow.comparison
                  ? `Net · FY ${cashFlow.period.financialYearLabel}`
                  : 'Net',
                color: 'var(--data-3)',
                values: cashFlow.monthly.map((month) => Number(month.netChange)),
              },
              /* Only net is carried over, for the reason given above the profit and loss chart. */
              ...(cashFlow.comparison
                ? [
                    {
                      label: `Net · FY ${cashFlow.comparison.financialYearLabel}`,
                      color: 'var(--data-4)',
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
