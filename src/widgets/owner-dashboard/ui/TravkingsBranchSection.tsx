import { ArrowRight } from 'lucide-react';
import type { Branch } from '@/entities/owner-portfolio';
import { formatCrLakh, formatPercent } from '@/entities/owner-portfolio';
import { BranchComparisonChart } from './BranchComparisonChart';
import styles from './TravkingsBranchSection.module.css';

interface TravkingsBranchSectionProps {
  branches: Branch[];
  onSelectBranch: (branchId: string) => void;
}

export function TravkingsBranchSection({
  branches,
  onSelectBranch,
}: TravkingsBranchSectionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Travkings Tour &amp; Travels — Branch Performance</h2>
          <span className={styles.badge}>5 Regional Hubs</span>
        </div>
        <span className={styles.subtitle}>
          Multi-hub analytics with individual capital, revenue, margins, and 4-partner dividend splits
        </span>
      </div>

      <div className={styles.cardsAndChartGrid}>
        {/* Branch Financial Table */}
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Investment</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Profit / Loss</th>
                <th>ROI</th>
                <th>Margin</th>
                <th>Growth</th>
                <th>Partner Share (Each)</th>
                <th>Drill-Down</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const isProfit = b.profit >= 0;
                const partnerShare = b.profit / 4;

                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelectBranch(b.id)}
                    title={`Click to inspect ${b.name} financial breakdown`}
                  >
                    <td>
                      <div className={styles.branchName}>
                        <span
                          className={`${styles.statusDot} ${isProfit ? styles.statusDotGreen : styles.statusDotRed}`}
                        />
                        {b.name}
                      </div>
                    </td>
                    <td className={styles.mono}>{formatCrLakh(b.investment)}</td>
                    <td className={styles.mono}>{formatCrLakh(b.revenue)}</td>
                    <td className={styles.mono}>{formatCrLakh(b.expenses)}</td>
                    <td
                      className={`${styles.monoBold} ${isProfit ? styles.profitPositive : styles.profitNegative}`}
                    >
                      {formatCrLakh(b.profit, { forceSign: true })}
                    </td>
                    <td
                      className={`${styles.mono} ${isProfit ? styles.profitPositive : styles.profitNegative}`}
                    >
                      {formatPercent(b.roi, { forceSign: true })}
                    </td>
                    <td className={styles.mono}>{formatPercent(b.profitMargin, { forceSign: true })}</td>
                    <td className={styles.mono}>{formatPercent(b.growthPercent, { forceSign: true })}</td>
                    <td
                      className={`${styles.mono} ${partnerShare >= 0 ? styles.profitPositive : styles.profitNegative}`}
                      style={{ fontWeight: 600 }}
                    >
                      {formatCrLakh(partnerShare, { forceSign: true })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.drillDownBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBranch(b.id);
                        }}
                      >
                        Inspect <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Visual Branch Comparison Chart */}
        <div className={styles.chartCard}>
          <BranchComparisonChart
            branches={branches}
            onSelectBranch={onSelectBranch}
          />
        </div>
      </div>
    </div>
  );
}
