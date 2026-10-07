import type { Business, Branch, MonthlyDataPoint } from '@/entities/owner-portfolio';
import { BusinessPerformanceChart } from './BusinessPerformanceChart';
import { FinancialPerformanceCombinedChart } from './FinancialPerformanceCombinedChart';
import { PortfolioGrowthChart } from './PortfolioGrowthChart';
import { ProfitabilityHeatmap } from './ProfitabilityHeatmap';
import styles from './PerformanceSection.module.css';

interface PerformanceSectionProps {
  businesses: Business[];
  branches: Branch[];
  portfolioMonthlyData: MonthlyDataPoint[];
  onSelectBusiness?: (id: string) => void;
  onSelectBranch?: (id: string) => void;
}

export function PerformanceSection({
  businesses,
  branches,
  portfolioMonthlyData,
  onSelectBusiness,
  onSelectBranch,
}: PerformanceSectionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Performance &amp; Analytics</h2>
        </div>
        <span className={styles.subtitle}>
          Interactive multi-dimensional financial tracking, revenue trends, and growth indicators
        </span>
      </div>

      {/* 1. Large Interactive Business Performance Chart */}
      <div className={styles.card}>
        <BusinessPerformanceChart
          businesses={businesses}
          onSelectBusiness={onSelectBusiness}
        />
      </div>

      {/* 2. Combined Financial Performance and Portfolio Growth */}
      <div className={styles.twoColGrid}>
        <div className={styles.card}>
          <FinancialPerformanceCombinedChart data={portfolioMonthlyData} />
        </div>

        <div className={styles.card}>
          <PortfolioGrowthChart />
        </div>
      </div>

      {/* 3. Profitability Heatmap */}
      <div className={styles.card}>
        <ProfitabilityHeatmap
          businesses={businesses}
          branches={branches}
          onSelectBusiness={onSelectBusiness}
          onSelectBranch={onSelectBranch}
        />
      </div>
    </div>
  );
}
