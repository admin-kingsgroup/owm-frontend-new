import { useState } from 'react';
import type { MonthlyDataPoint } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import styles from './FinancialPerformanceCombinedChart.module.css';

interface FinancialPerformanceCombinedChartProps {
  data: MonthlyDataPoint[];
}

export function FinancialPerformanceCombinedChart({
  data,
}: FinancialPerformanceCombinedChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<MonthlyDataPoint | null>(null);

  // Determine scale
  const revenues = data.map((d) => d.revenue);
  const expenses = data.map((d) => d.expenses);

  const maxVal = Math.max(...revenues, ...expenses) * 1.15; // Room at top
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const svgWidth = 620;
  const svgHeight = 210;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 30;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  function getY(val: number): number {
    return padTop + ((maxVal - val) / range) * plotHeight;
  }

  function getGroupX(index: number): number {
    return padLeft + (index / data.length) * plotWidth;
  }

  const slotWidth = plotWidth / data.length;
  const barWidth = 18;
  const gap = 3;

  // Build profit line path
  const linePoints = data.map((d, i) => {
    const x = getGroupX(i) + slotWidth / 2;
    const y = getY(d.profit);
    return { x, y, data: d };
  });

  const linePath = linePoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Financial Performance</h3>
          <span className={styles.subtitle}>
            Revenue vs Expenses vs Resulting Net Profit over time
          </span>
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ backgroundColor: '#1a52c4' }} />
            <span>Revenue</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ backgroundColor: '#656a72' }} />
            <span>Expenses</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendLineSwatch} style={{ backgroundColor: '#15803d' }} />
            <span>Net Profit</span>
          </div>
        </div>
      </div>

      <div className={styles.chartCard}>
        {hoveredPoint && (
          <div className={styles.tooltip}>
            <span className={styles.tooltipTitle}>{hoveredPoint.month} Summary</span>
            <div className={styles.tooltipRow}>
              <span style={{ color: '#1a52c4' }}>Revenue:</span>
              <span>{formatCrLakh(hoveredPoint.revenue)}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span style={{ color: '#656a72' }}>Expenses:</span>
              <span>{formatCrLakh(hoveredPoint.expenses)}</span>
            </div>
            <div className={styles.tooltipRow}>
              <span style={{ color: '#15803d', fontWeight: 700 }}>Profit:</span>
              <span style={{ color: '#15803d', fontWeight: 700 }}>
                {formatCrLakh(hoveredPoint.profit, { forceSign: true })}
              </span>
            </div>
          </div>
        )}

        <svg
          className={styles.svg}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label="Revenue vs Expenses vs Profit combined chart"
        >
          {/* Y Axis Gridlines and Ticks */}
          {[0, 0.33, 0.66, 1].map((pct) => {
            const val = pct * maxVal;
            const y = getY(val);
            return (
              <g key={pct}>
                <line
                  x1={padLeft}
                  x2={svgWidth - padRight}
                  y1={y}
                  y2={y}
                  className={styles.gridLine}
                />
                <text x={padLeft - 8} y={y + 3} className={styles.axisLabel}>
                  {formatCrLakh(val)}
                </text>
              </g>
            );
          })}

          {/* Bars: Revenue and Expenses side-by-side */}
          {data.map((item, idx) => {
            const groupStartX = getGroupX(idx) + (slotWidth - (barWidth * 2 + gap)) / 2;
            const revX = groupStartX;
            const expX = groupStartX + barWidth + gap;

            const revY = getY(item.revenue);
            const expY = getY(item.expenses);
            const groundY = getY(0);

            const revHeight = Math.max(3, groundY - revY);
            const expHeight = Math.max(3, groundY - expY);

            return (
              <g
                key={item.month}
                onMouseEnter={() => setHoveredPoint(item)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Revenue Bar */}
                <rect
                  x={revX}
                  y={revY}
                  width={barWidth}
                  height={revHeight}
                  rx="2"
                  className={styles.revenueBar}
                >
                  <title>{`${item.month} Revenue: ${formatCrLakh(item.revenue)}`}</title>
                </rect>

                {/* Expense Bar */}
                <rect
                  x={expX}
                  y={expY}
                  width={barWidth}
                  height={expHeight}
                  rx="2"
                  className={styles.expenseBar}
                >
                  <title>{`${item.month} Expenses: ${formatCrLakh(item.expenses)}`}</title>
                </rect>

                {/* X axis month label */}
                <text
                  x={getGroupX(idx) + slotWidth / 2}
                  y={svgHeight - 10}
                  className={styles.xLabel}
                >
                  {item.month}
                </text>
              </g>
            );
          })}

          {/* Profit Combined Line */}
          <path d={linePath} className={styles.profitLine} />

          {/* Profit points */}
          {linePoints.map((pt) => (
            <circle
              key={pt.data.month}
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              className={styles.profitPoint}
              onMouseEnter={() => setHoveredPoint(pt.data)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <title>{`${pt.data.month} Profit: ${formatCrLakh(pt.data.profit, { forceSign: true })}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
