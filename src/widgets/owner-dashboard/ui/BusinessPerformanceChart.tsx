import { useMemo, useState } from 'react';
import type { Business, MetricType, TimeRangeFilter } from '@/entities/owner-portfolio';
import { formatCrLakh, formatPercent } from '@/entities/owner-portfolio';
import styles from './BusinessPerformanceChart.module.css';

interface BusinessPerformanceChartProps {
  businesses: Business[];
  onSelectBusiness?: (businessId: string) => void;
}

type ChartType = 'Line' | 'Bar' | 'Area';

const BUSINESS_COLORS: Record<string, string> = {
  'biz-travkings': '#1a52c4', // Blue
  'biz-quinaliza': '#2f7a72', // Teal
  'biz-kings-logistic': '#6b4f9e', // Purple
  'biz-hotel-kings': '#b91c1c', // Deep Red for loss business / Copper
  'biz-techkings': '#9a7b28', // Rich Gold
};

export function BusinessPerformanceChart({
  businesses,
  onSelectBusiness,
}: BusinessPerformanceChartProps) {
  const [metric, setMetric] = useState<MetricType>('Revenue');
  const [chartType, setChartType] = useState<ChartType>('Line');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('6M');
  const [activeHover, setActiveHover] = useState<{
    businessName: string;
    month: string;
    value: number;
    color: string;
  } | null>(null);

  // Hidden series set for interactive legend filtering
  const [hiddenBizIds, setHiddenBizIds] = useState<Set<string>>(new Set());

  // All months available in monthlyData: Jan, Feb, Mar, Apr, May, Jun
  const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // Slice months based on time range
  const months = useMemo(() => {
    switch (timeRange) {
      case '1M':
        return allMonths.slice(-1);
      case '3M':
        return allMonths.slice(-3);
      case '6M':
      case '1Y':
      case '3Y':
      case 'ALL':
      default:
        return allMonths;
    }
  }, [timeRange]);

  function getMetricValue(biz: Business, monthIndex: number, m: MetricType): number {
    const dataPoint = biz.monthlyData[monthIndex] ?? biz.monthlyData[0];
    if (!dataPoint) return 0;

    switch (m) {
      case 'Revenue':
        return dataPoint.revenue;
      case 'Profit':
        return dataPoint.profit;
      case 'Expenses':
        return dataPoint.expenses;
      case 'Investment':
        return biz.investment;
      case 'ROI':
        return dataPoint.revenue > 0
          ? ((dataPoint.profit / (biz.investment / 6)) * 100)
          : biz.roi;
      default:
        return dataPoint.revenue;
    }
  }

  function formatDisplayValue(val: number, m: MetricType): string {
    if (m === 'ROI') {
      return formatPercent(val, { forceSign: true });
    }
    return formatCrLakh(val, { forceSign: m === 'Profit' });
  }

  // Active businesses
  const visibleBusinesses = businesses.filter((b) => !hiddenBizIds.has(b.id));

  // Compute scale
  const allValues: number[] = [];
  visibleBusinesses.forEach((biz) => {
    months.forEach((_, idx) => {
      // Find index in original monthlyData
      const originalIdx = allMonths.indexOf(months[idx]);
      allValues.push(getMetricValue(biz, originalIdx, metric));
    });
  });

  const maxVal = allValues.length > 0 ? Math.max(0, ...allValues) : 100;
  const minVal = allValues.length > 0 ? Math.min(0, ...allValues) : 0;
  const range = maxVal - minVal || 1;

  // ViewBox dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 60;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 30;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Zero-line coordinate
  const zeroY = padTop + (maxVal / range) * plotHeight;

  function getY(val: number): number {
    return padTop + ((maxVal - val) / range) * plotHeight;
  }

  function getX(monthIdx: number): number {
    if (months.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (monthIdx / (months.length - 1)) * plotWidth;
  }

  function toggleBusiness(id: string) {
    setHiddenBizIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Prevent hiding all businesses
        if (next.size < businesses.length - 1) {
          next.add(id);
        }
      }
      return next;
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.leftHead}>
          <h3 className={styles.title}>Business Performance Comparison</h3>
          <span className={styles.subtitle}>
            Analyze financial indicators across all 5 portfolio holdings
          </span>
        </div>

        <div className={styles.controlsWrap}>
          {/* Metric Selector */}
          <div className={styles.pillGroup}>
            {(['Revenue', 'Profit', 'Investment', 'Expenses', 'ROI'] as MetricType[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`${styles.pillBtn} ${metric === m ? styles.pillBtnActive : ''}`}
                onClick={() => setMetric(m)}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className={styles.pillGroup}>
            {(['Line', 'Bar', 'Area'] as ChartType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.pillBtn} ${chartType === t ? styles.pillBtnActive : ''}`}
                onClick={() => setChartType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Time Filter */}
          <div className={styles.pillGroup}>
            {(['1M', '3M', '6M', '1Y', '3Y', 'ALL'] as TimeRangeFilter[]).map((tf) => (
              <button
                key={tf}
                type="button"
                className={`${styles.pillBtn} ${timeRange === tf ? styles.pillBtnActive : ''}`}
                onClick={() => setTimeRange(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Series Legend */}
      <div className={styles.legendBar}>
        {businesses.map((biz) => {
          const isHidden = hiddenBizIds.has(biz.id);
          const color = BUSINESS_COLORS[biz.id] ?? '#1a52c4';
          return (
            <button
              key={biz.id}
              type="button"
              className={`${styles.legendItem} ${isHidden ? styles.legendItemDisabled : ''}`}
              onClick={() => toggleBusiness(biz.id)}
              onDoubleClick={() => onSelectBusiness?.(biz.id)}
              title="Click to toggle, double click to drill down"
            >
              <span className={styles.swatch} style={{ backgroundColor: color }} />
              <span>{biz.name}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Canvas */}
      <div className={styles.chartArea}>
        {activeHover && (
          <div className={styles.tooltip}>
            <span className={styles.tooltipTitle}>{activeHover.businessName}</span>
            <span style={{ color: activeHover.color }}>
              {activeHover.month}: {formatDisplayValue(activeHover.value, metric)}
            </span>
          </div>
        )}

        <svg
          className={styles.svg}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Interactive ${metric} chart`}
        >
          {/* Y Axis Gridlines and Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const val = minVal + pct * range;
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
                  {formatDisplayValue(val, metric)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          {minVal < 0 && (
            <line
              x1={padLeft}
              x2={svgWidth - padRight}
              y1={zeroY}
              y2={zeroY}
              className={styles.zeroLine}
            />
          )}

          {/* X Axis Labels */}
          {months.map((m, idx) => (
            <text
              key={m}
              x={getX(idx)}
              y={svgHeight - 10}
              className={styles.xLabel}
            >
              {m}
            </text>
          ))}

          {/* Render Series Data */}
          {chartType === 'Bar' ? (
            // Grouped Bar chart
            months.map((month, mIdx) => {
              const originalIdx = allMonths.indexOf(month);
              const groupX = padLeft + (mIdx / months.length) * plotWidth;
              const groupSlotWidth = plotWidth / months.length;
              const count = visibleBusinesses.length;
              const barWidth = Math.min(18, (groupSlotWidth * 0.75) / count);
              const offsetStart = (groupSlotWidth - barWidth * count) / 2;

              return (
                <g key={month} className={styles.barGroup}>
                  {visibleBusinesses.map((biz, bIdx) => {
                    const val = getMetricValue(biz, originalIdx, metric);
                    const isNeg = val < 0;
                    const y = isNeg ? zeroY : getY(val);
                    const barHeight = Math.max(2, Math.abs(getY(val) - zeroY));
                    const x = groupX + offsetStart + bIdx * barWidth;
                    const color = BUSINESS_COLORS[biz.id] ?? '#1a52c4';

                    return (
                      <rect
                        key={biz.id}
                        x={x}
                        y={y}
                        width={barWidth * 0.88}
                        height={barHeight}
                        fill={color}
                        rx="2"
                        onMouseEnter={() =>
                          setActiveHover({
                            businessName: biz.name,
                            month,
                            value: val,
                            color,
                          })
                        }
                        onMouseLeave={() => setActiveHover(null)}
                      />
                    );
                  })}
                </g>
              );
            })
          ) : (
            // Line or Area Chart
            visibleBusinesses.map((biz) => {
              const color = BUSINESS_COLORS[biz.id] ?? '#1a52c4';
              const points = months.map((month, idx) => {
                const originalIdx = allMonths.indexOf(month);
                const val = getMetricValue(biz, originalIdx, metric);
                return {
                  x: getX(idx),
                  y: getY(val),
                  val,
                  month,
                };
              });

              const linePath = points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
                .join(' ');

              const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

              return (
                <g key={biz.id}>
                  {chartType === 'Area' && (
                    <path
                      d={areaPath}
                      fill={color}
                      className={styles.seriesArea}
                    />
                  )}

                  <path
                    d={linePath}
                    stroke={color}
                    className={styles.seriesLine}
                  />

                  {points.map((pt) => (
                    <circle
                      key={pt.month}
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      fill="var(--paper-card)"
                      stroke={color}
                      strokeWidth="2"
                      className={styles.dot}
                      onMouseEnter={() =>
                        setActiveHover({
                          businessName: biz.name,
                          month: pt.month,
                          value: pt.val,
                          color,
                        })
                      }
                      onMouseLeave={() => setActiveHover(null)}
                    />
                  ))}
                </g>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}
