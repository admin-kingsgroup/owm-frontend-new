import type { ProfitAndLossReport, ReportNode } from '@/entities/report';
import { ColumnChart } from '@/shared/ui';

import { MonthlyFigures } from './MonthlyFigures';
import { ReportTree } from './ReportTree';
import styles from './ReportsPage.module.css';

interface ProfitLossViewProps {
  report: ProfitAndLossReport;
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
 * What was earned and what it cost, month by month and then in total.
 *
 * The shape comes first and the figures after it: the chart answers "when", the statement answers
 * "how much", and a reader almost always wants them in that order.
 */
export function ProfitLossView({
  report: profitLoss,
  money,
  monthLabel,
  openLedger,
}: ProfitLossViewProps) {
  return (
    <>
      {profitLoss.monthly.length > 1 && (
        <section className={styles.chartPanel}>
          <h2 className={styles.chartTitle}>Month by month</h2>
          <ColumnChart
            labels={profitLoss.monthly.map((month) => monthLabel(month.month))}
            formatValue={money}
            scaleLabel={money}
            caption={
              profitLoss.comparison
                ? `Income, expenses and net profit each month, against the net profit of FY ${profitLoss.comparison.financialYearLabel}`
                : 'Income, expenses and net profit for each month of the period'
            }
            series={[
              {
                label: 'Income',
                color: 'var(--data-1)',
                values: profitLoss.monthly.map((month) => Number(month.income)),
              },
              {
                label: 'Expenses',
                color: 'var(--data-2)',
                values: profitLoss.monthly.map((month) => Number(month.expenses)),
              },
              {
                /* Named for its year only while there are two of them on the plot. */
                label: profitLoss.comparison
                  ? `Net · FY ${profitLoss.period.financialYearLabel}`
                  : 'Net',
                color: 'var(--data-3)',
                values: profitLoss.monthly.map((month) => Number(month.netProfit)),
              },
              /*
                Only net is carried over from last year: its income and expenses as well would put
                six bars in every month and the shape would be lost. Net is the figure that answers
                "was this month better than the same month last year", and it is drawn beside this
                year's net so the pair can actually be read against each other.
              */
              ...(profitLoss.comparison
                ? [
                    {
                      label: `Net · FY ${profitLoss.comparison.financialYearLabel}`,
                      color: 'var(--data-4)',
                      values: profitLoss.monthly.map((month) => Number(month.priorNetProfit ?? 0)),
                    },
                  ]
                : []),
            ]}
          />
          <MonthlyFigures
            labels={profitLoss.monthly.map((month) => monthLabel(month.month))}
            format={money}
            series={[
              {
                label: 'Income',
                values: profitLoss.monthly.map((month) => Number(month.income)),
              },
              {
                label: 'Expenses',
                values: profitLoss.monthly.map((month) => Number(month.expenses)),
              },
              {
                label: profitLoss.comparison
                  ? `Net · FY ${profitLoss.period.financialYearLabel}`
                  : 'Net',
                values: profitLoss.monthly.map((month) => Number(month.netProfit)),
              },
              /*
                A month the prior year had nothing in is null here, not zero: the chart draws it as
                no bar, and the table has to say the same thing rather than claim a nil result.
              */
              ...(profitLoss.comparison
                ? [
                    {
                      label: `Net · FY ${profitLoss.comparison.financialYearLabel}`,
                      values: profitLoss.monthly.map((month) =>
                        month.priorNetProfit === undefined ? null : Number(month.priorNetProfit),
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>
      )}

      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Income
            {profitLoss.totals.priorIncome !== undefined && (
              <span className={styles.panelPrior}>{money(profitLoss.totals.priorIncome)}</span>
            )}
            <span className={styles.panelTotal}>{money(profitLoss.totals.income)}</span>
          </h2>
          <ReportTree
            formatAmount={money}
            nodes={profitLoss.income}
            onSelectLedger={openLedger}
            showPrior={Boolean(profitLoss.comparison)}
          />
        </section>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Expenses{' '}
            {profitLoss.totals.priorExpenses !== undefined && (
              <span className={styles.panelPrior}>{money(profitLoss.totals.priorExpenses)}</span>
            )}
            <span className={styles.panelTotal}>{money(profitLoss.totals.expenses)}</span>
          </h2>
          <ReportTree
            formatAmount={money}
            nodes={profitLoss.expenses}
            onSelectLedger={openLedger}
            showPrior={Boolean(profitLoss.comparison)}
          />
          <div className={styles.derivedRow}>
            <span>{Number(profitLoss.totals.netProfit) < 0 ? 'Net loss' : 'Net profit'}</span>
            <span>
              {profitLoss.totals.priorNetProfit !== undefined && (
                <span className={styles.panelPrior}>{money(profitLoss.totals.priorNetProfit)}</span>
              )}
              {money(profitLoss.totals.netProfit)}
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
