import { useState } from 'react';
import type { Branch, MetricType } from '@/entities/owner-portfolio';
import { formatCrLakh, formatPercent } from '@/entities/owner-portfolio';
import styles from './BranchComparisonChart.module.css';

interface BranchComparisonChartProps {
  branches: Branch[];
  onSelectBranch?: (branchId: string) => void;
}

export function BranchComparisonChart({
  branches,
  onSelectBranch,
}: BranchComparisonChartProps) {
  const [metric, setMetric] = useState<MetricType>('Profit');

  function getBranchValue(branch: Branch, m: MetricType): number {
    switch (m) {
      case 'Revenue':
        return branch.revenue;
      case 'Profit':
        return branch.profit;
      case 'Investment':
        return branch.investment;
      case 'Expenses':
        return branch.expenses;
      case 'ROI':
        return branch.roi;
      default:
        return branch.profit;
    }
  }

  function formatValue(val: number, m: MetricType): string {
    if (m === 'ROI') {
      return formatPercent(val, { forceSign: true });
    }
    return formatCrLakh(val, { forceSign: m === 'Profit' });
  }

  // Calculate min, max, span for SVG rendering
  const values = branches.map((b) => getBranchValue(b, metric));
  const maxVal = Math.max(0, ...values);
  const minVal = Math.min(0, ...values);
  const range = maxVal - minVal || 1;

  // ViewBox: 500 wide, 180 high
  const width = 500;
  const height = 180;
  const padTop = 24;
  const padBottom = 34;
  const plotHeight = height - padTop - padBottom;

  // Zero-line Y
  const zeroY = padTop + (maxVal / range) * plotHeight;

  const groupWidth = width / branches.length;
  const barWidth = 42;

  return (
    <div className={styles.container}>
      <div className={styles.controlsRow}>
        <div className={styles.titleGroup}>
          <h3 className={styles.chartTitle}>Travkings Branch Performance</h3>
          <span className={styles.chartSubtitle}>Comparing 5 Regional Centers</span>
        </div>

        <div className={styles.metricTabs}>
          {(['Revenue', 'Profit', 'Investment', 'Expenses', 'ROI'] as MetricType[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.metricBtn} ${metric === m ? styles.metricBtnActive : ''}`}
              onClick={() => setMetric(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartCard}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Branch comparison by ${metric}`}
        >
          {/* Zero reference line */}
          <line
            x1="20"
            x2={width - 20}
            y1={zeroY}
            y2={zeroY}
            className={styles.zeroLine}
          />

          {branches.map((branch, index) => {
            const val = getBranchValue(branch, metric);
            const isNegative = val < 0;
            const barHeight = Math.max(3, (Math.abs(val) / range) * plotHeight);

            const x = index * groupWidth + (groupWidth - barWidth) / 2;
            const y = isNegative ? zeroY : zeroY - barHeight;

            // Bar color logic
            let barColorClass = styles.barNeutral;
            if (metric === 'Profit' || metric === 'ROI') {
              barColorClass = isNegative ? styles.barNegative : styles.barPositive;
            }

            // Value label Y
            const valLabelY = isNegative ? y + barHeight + 12 : y - 6;

            return (
              <g key={branch.id} onClick={() => onSelectBranch?.(branch.id)}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  className={`${styles.bar} ${barColorClass}`}
                >
                  <title>{`${branch.name} (${metric}): ${formatValue(val, metric)} (Click to view detail)`}</title>
                </rect>

                {/* Value label */}
                <text
                  x={x + barWidth / 2}
                  y={valLabelY}
                  className={styles.valueLabel}
                  fill={isNegative ? '#b91c1c' : metric === 'Profit' ? '#15803d' : '#121316'}
                >
                  {formatValue(val, metric)}
                </text>

                {/* Branch name label */}
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  className={styles.label}
                >
                  {branch.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className={styles.hint}>
        <span>Click any branch bar to inspect detailed financials &amp; cost breakdown</span>
      </div>
    </div>
  );
}
