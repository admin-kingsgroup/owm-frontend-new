import { portfolioGrowthData, formatCrLakh } from '@/entities/owner-portfolio';
import styles from './PortfolioGrowthChart.module.css';

export function PortfolioGrowthChart() {
  const data = portfolioGrowthData;

  // Max value: ₹18 Cr to give headroom over ₹17.4 Cr
  const maxVal = 200_000_000; // 20 Cr
  const minVal = 100_000_000; // 10 Cr
  const range = maxVal - minVal;

  const svgWidth = 600;
  const svgHeight = 190;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 30;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  function getY(val: number): number {
    return padTop + ((maxVal - val) / range) * plotHeight;
  }

  function getX(index: number): number {
    return padLeft + (index / (data.length - 1)) * plotWidth;
  }

  const valuePoints = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.currentValue),
    val: d.currentValue,
    year: d.year,
  }));

  const investPoints = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.investment),
    val: d.investment,
    year: d.year,
  }));

  const valueLinePath = valuePoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${valueLinePath} L ${valuePoints[valuePoints.length - 1].x.toFixed(1)} ${getY(minVal).toFixed(1)} L ${valuePoints[0].x.toFixed(1)} ${getY(minVal).toFixed(1)} Z`;

  const investLinePath = investPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>Portfolio Growth Over Time</h3>
          <span className={styles.subtitle}>
            Total Capital Injected vs Cumulative Business Valuation
          </span>
        </div>

        <div className={styles.badgeAndLegend}>
          <div className={styles.growthBadge}>
            <span>Total Growth: +34.6%</span>
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={styles.swatch} style={{ backgroundColor: '#1a52c4' }} />
              <span>Current Value</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.swatch} style={{ backgroundColor: '#656a72' }} />
              <span>Investment Base</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chartCard}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label="Portfolio Growth Area Chart"
        >
          {/* Y Axis Gridlines */}
          {[100_000_000, 125_000_000, 150_000_000, 175_000_000, 200_000_000].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
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

          {/* Area fill under Current Value */}
          <path d={areaPath} className={styles.valueArea} />

          {/* Investment Baseline (Dashed) */}
          <path d={investLinePath} className={styles.investLine} />

          {/* Current Value Line (Solid) */}
          <path d={valueLinePath} className={styles.valueLine} />

          {/* Investment Points */}
          {investPoints.map((pt) => (
            <circle
              key={`invest-${pt.year}`}
              cx={pt.x}
              cy={pt.y}
              r="4"
              className={`${styles.point} ${styles.pointInvest}`}
            >
              <title>{`${pt.year} Invested: ${formatCrLakh(pt.val)}`}</title>
            </circle>
          ))}

          {/* Current Value Points and Tags */}
          {valuePoints.map((pt) => (
            <g key={`val-${pt.year}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4.5"
                className={`${styles.point} ${styles.pointValue}`}
              >
                <title>{`${pt.year} Current Value: ${formatCrLakh(pt.val)}`}</title>
              </circle>
              <text
                x={pt.x}
                y={pt.y - 10}
                className={styles.valueTag}
                fill="#1a52c4"
              >
                {formatCrLakh(pt.val)}
              </text>
            </g>
          ))}

          {/* X Axis Year Labels */}
          {data.map((d, i) => (
            <text
              key={d.year}
              x={getX(i)}
              y={svgHeight - 10}
              className={styles.xLabel}
            >
              {d.year}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
