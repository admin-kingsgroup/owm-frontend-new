import { CircleCheck, Landmark, Scale, TrendingUp } from 'lucide-react';

import type { BalanceSheetReport, ReportNode } from '@/entities/report';
import { KpiTile } from '@/shared/ui';

import { ReportTree } from './ReportTree';
import styles from './ReportsPage.module.css';

interface BalanceSheetViewProps {
  report: BalanceSheetReport;
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** A figure in full, nil included — for the tiles, where a blank would read as unread. */
  figure: (value: string | number) => string;
  /** Opens the ledger behind a row. */
  openLedger: (node: ReportNode) => void;
}

/** A change against the comparison year, as a percentage, where there is one to compare with. */
function change(now: string, before: string | undefined): number | null {
  if (before === undefined || Number(before) === 0) return null;
  return ((Number(now) - Number(before)) / Math.abs(Number(before))) * 100;
}

/**
 * The liabilities side in full: the groups plus the period's profit, which is earned and not yet
 * drawn and so belongs here even though it arrives from the Profit & Loss rather than from a group.
 *
 * Added as numbers because both are already rounded to the penny by the server. The figure that has
 * to tie exactly is `totals.difference`, which the server computes and this never touches.
 */
function sideTotal(liabilities: string, profit: string | undefined): string {
  return (Number(liabilities) + Number(profit ?? 0)).toFixed(2);
}

/**
 * What the company owns against what it owes, as at the period's end.
 *
 * Two panels rather than one long list, because the question a reader brings is whether the sides
 * agree — and that is answered by looking across, not down.
 */
export function BalanceSheetView({
  report: balanceSheet,
  money,
  figure,
  openLedger,
}: BalanceSheetViewProps) {
  const { totals } = balanceSheet;
  const liabilitiesSide = sideTotal(totals.liabilities, totals.currentPeriodProfit);
  const priorLiabilitiesSide =
    totals.priorLiabilities === undefined
      ? undefined
      : sideTotal(totals.priorLiabilities, totals.priorCurrentPeriodProfit);
  const comparing = Boolean(balanceSheet.comparison);

  return (
    <>
      {/* The two sides and the profit between them, before the trees that make them up. */}
      <div className={styles.tiles}>
        <KpiTile
          index={0}
          label="Total assets"
          icon={<Landmark />}
          value={Number(totals.assets)}
          format={figure}
          delta={comparing ? change(totals.assets, totals.priorAssets) : null}
          hint={comparing ? `vs FY ${balanceSheet.comparison?.financialYearLabel}` : undefined}
        />
        <KpiTile
          index={1}
          label="Liabilities & capital"
          icon={<Scale />}
          value={Number(liabilitiesSide)}
          format={figure}
          delta={comparing ? change(liabilitiesSide, priorLiabilitiesSide) : null}
          hint="profit for the period included"
        />
        <KpiTile
          index={2}
          label="Profit for the period"
          icon={<TrendingUp />}
          value={Number(totals.currentPeriodProfit)}
          format={figure}
          negative={Number(totals.currentPeriodProfit) < 0}
          delta={
            comparing ? change(totals.currentPeriodProfit, totals.priorCurrentPeriodProfit) : null
          }
        />
      </div>

      {/* Said before the two sides rather than after: the last thing on the page is the statement. */}
      {balanceSheet.totals.difference === '0.00' && (
        <p className={styles.tie}>
          <CircleCheck size={16} aria-hidden="true" />
          Assets equal liabilities and capital: {figure(totals.assets)} on both sides
        </p>
      )}

      <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Assets
            {balanceSheet.totals.priorAssets !== undefined && (
              <span className={styles.panelPrior}>{money(balanceSheet.totals.priorAssets)}</span>
            )}
            <span className={styles.panelTotal}>{money(balanceSheet.totals.assets)}</span>
          </h2>
          <ReportTree
            formatAmount={money}
            nodes={balanceSheet.assets}
            onSelectLedger={openLedger}
            showPrior={Boolean(balanceSheet.comparison)}
          />
        </section>
        <section className={styles.panel}>
          {/*
            The heading totals the whole side, the period profit included.

            Profit belongs to this side — it is what the owner has earned and not yet drawn — but
            it sits in its own row below because it comes from the Profit & Loss rather than from
            a group. Totalling only the groups printed "Liabilities ₹0.00" beside "Assets
            ₹4,53,600.00" on books that balance perfectly, which reads as an error and is not one.
          */}
          <h2 className={styles.panelTitle}>
            Liabilities{' '}
            {balanceSheet.totals.priorLiabilities !== undefined && (
              <span className={styles.panelPrior}>
                {money(
                  sideTotal(
                    balanceSheet.totals.priorLiabilities,
                    balanceSheet.totals.priorCurrentPeriodProfit,
                  ),
                )}
              </span>
            )}
            <span className={styles.panelTotal}>
              {money(
                sideTotal(balanceSheet.totals.liabilities, balanceSheet.totals.currentPeriodProfit),
              )}
            </span>
          </h2>
          <ReportTree
            formatAmount={money}
            nodes={balanceSheet.liabilities}
            onSelectLedger={openLedger}
            showPrior={Boolean(balanceSheet.comparison)}
          />
          <div className={styles.derivedRow}>
            <span>Profit for the period</span>
            <span>
              {balanceSheet.totals.priorCurrentPeriodProfit !== undefined && (
                <span className={styles.panelPrior}>
                  {money(balanceSheet.totals.priorCurrentPeriodProfit)}
                </span>
              )}
              {money(balanceSheet.totals.currentPeriodProfit)}
            </span>
          </div>
          {balanceSheet.totals.difference !== '0.00' && (
            <p className={styles.warning}>
              Out of balance by {money(balanceSheet.totals.difference)}. Check opening balances.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
