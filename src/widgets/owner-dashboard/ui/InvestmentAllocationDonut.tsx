import { useMemo, useState } from 'react';
import type { Business } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import styles from './InvestmentAllocationDonut.module.css';

interface InvestmentAllocationDonutProps {
  businesses: Business[];
  totalInvestment: number;
  currentValue: number;
}

const BUSINESS_COLORS: Record<string, string> = {
  'biz-travkings': '#1a52c4', // Executive blue
  'biz-hotel-kings': '#b0663a', // Rich copper
  'biz-quinaliza': '#2f7a72', // Teal
  'biz-kings-logistic': '#6b4f9e', // Slate purple
  'biz-techkings': '#9a7b28', // Muted gold/amber
};

export function InvestmentAllocationDonut({
  businesses,
  totalInvestment,
  currentValue,
}: InvestmentAllocationDonutProps) {
  const [hoveredBizId, setHoveredBizId] = useState<string | null>(null);

  // SVG circle calculations: radius = 38 -> circumference = 2 * PI * 38 ≈ 238.761
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let accumulatedPercent = 0;
    return businesses.map((biz) => {
      const color = BUSINESS_COLORS[biz.id] ?? '#4f535a';
      const percent = totalInvestment > 0 ? (biz.investment / totalInvestment) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += percent;

      return {
        id: biz.id,
        name: biz.name,
        shortName: biz.shortName,
        investment: biz.investment,
        percent,
        color,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [businesses, totalInvestment, circumference]);

  const activeSegment = hoveredBizId
    ? segments.find((s) => s.id === hoveredBizId)
    : null;

  const totalReturn = currentValue - totalInvestment;

  return (
    <div className={styles.container}>
      <div className={styles.chartRow}>
        <div className={styles.donutWrapper}>
          <svg className={styles.svg} viewBox="0 0 100 100" role="img" aria-label="Investment Allocation Chart">
            <circle cx="50" cy="50" r={radius} className={styles.donutTrack} />
            {segments.map((seg) => (
              <circle
                key={seg.id}
                cx="50"
                cy="50"
                r={radius}
                className={styles.segment}
                stroke={seg.color}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                onMouseEnter={() => setHoveredBizId(seg.id)}
                onMouseLeave={() => setHoveredBizId(null)}
              >
                <title>{`${seg.name}: ${formatCrLakh(seg.investment)} (${seg.percent.toFixed(1)}%)`}</title>
              </circle>
            ))}
          </svg>

          <div className={styles.centerLabel}>
            <span className={styles.centerCaption}>
              {activeSegment ? activeSegment.shortName : 'Total Capital'}
            </span>
            <span className={styles.centerValue}>
              {activeSegment ? formatCrLakh(activeSegment.investment) : formatCrLakh(totalInvestment)}
            </span>
          </div>
        </div>

        <div className={styles.barsList}>
          {segments.map((seg) => (
            <div
              key={seg.id}
              className={styles.barItem}
              onMouseEnter={() => setHoveredBizId(seg.id)}
              onMouseLeave={() => setHoveredBizId(null)}
            >
              <div className={styles.barHeader}>
                <div className={styles.barLabelGroup}>
                  <span className={styles.colorDot} style={{ backgroundColor: seg.color }} />
                  <span className={styles.barName}>{seg.name}</span>
                </div>
                <div className={styles.barAmounts}>
                  <span className={styles.barPercent}>{seg.percent.toFixed(0)}%</span>
                  <span className={styles.barValue}>{formatCrLakh(seg.investment)}</span>
                </div>
              </div>
              <div className={styles.track}>
                <div
                  className={styles.fill}
                  style={{
                    width: `${seg.percent}%`,
                    backgroundColor: seg.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.metricsRow}>
        <div className={styles.metricItem}>
          <span className={styles.metricTitle}>Initial Capital</span>
          <span className={styles.metricAmount}>₹9.8 Cr</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricTitle}>Growth Injections</span>
          <span className={styles.metricAmount}>₹3.0 Cr</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricTitle}>Current Value</span>
          <span className={styles.metricAmount}>{formatCrLakh(currentValue)}</span>
        </div>
        <div className={styles.metricItem}>
          <span className={styles.metricTitle}>Total Return</span>
          <span className={`${styles.metricAmount} ${totalReturn >= 0 ? styles.metricPositive : ''}`}>
            {formatCrLakh(totalReturn, { forceSign: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
