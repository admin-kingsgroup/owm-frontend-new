import { ArrowLeft } from 'lucide-react';
import type { Branch } from '@/entities/owner-portfolio';
import { formatCrLakh, formatPercent, calculatePartnerShare } from '@/entities/owner-portfolio';
import styles from './BranchDrillDownView.module.css';

interface BranchDrillDownViewProps {
  branch: Branch;
  allBranches: Branch[];
  onBack: () => void;
  onSelectOtherBranch: (branchId: string) => void;
}

export function BranchDrillDownView({
  branch,
  allBranches,
  onBack,
  onSelectOtherBranch,
}: BranchDrillDownViewProps) {
  const isProfit = branch.profit >= 0;
  const partnerShareAmount = calculatePartnerShare(branch.profit, 4);

  // Revenue SVG Spark/Bar calculations
  const maxRevenue = Math.max(...branch.monthlyRevenue.map((r) => r.amount)) * 1.1;
  const maxProfitVal = Math.max(...branch.monthlyProfit.map((p) => Math.abs(p.amount))) * 1.2 || 1;

  const partnerColors = ['#1a52c4', '#2f7a72', '#6b4f9e', '#9a7b28'];

  return (
    <div className={styles.container}>
      {/* Top Navigation & Branch Switcher */}
      <div className={styles.backBar}>
        <div className={styles.branchHeader}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} /> Back to Branches
          </button>
          <span className={styles.branchCodeBadge}>Travkings / {branch.code}</span>
          <h2 className={styles.branchTitle}>{branch.name} Regional Hub</h2>
        </div>

        <div className={styles.branchSwitcher}>
          {allBranches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${styles.switchBtn} ${b.id === branch.id ? styles.switchBtnActive : ''}`}
              onClick={() => onSelectOtherBranch(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Branch Financial Overview Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Investment</span>
          <span className={styles.kpiValue}>{formatCrLakh(branch.investment)}</span>
          <span className={styles.kpiSub}>Fleet &amp; Hub Depot</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Revenue</span>
          <span className={styles.kpiValue}>{formatCrLakh(branch.revenue)}</span>
          <span className={styles.kpiSub}>Gross Bookings</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Expenses</span>
          <span className={styles.kpiValue}>{formatCrLakh(branch.expenses)}</span>
          <span className={styles.kpiSub}>Operations &amp; Fuel</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Net Profit / Loss</span>
          <span
            className={`${styles.kpiValue} ${isProfit ? styles.kpiPositive : styles.kpiNegative}`}
          >
            {formatCrLakh(branch.profit, { forceSign: true })}
          </span>
          <span className={styles.kpiSub}>Operating Margin: {formatPercent(branch.profitMargin)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Return on Capital (ROI)</span>
          <span
            className={`${styles.kpiValue} ${isProfit ? styles.kpiPositive : styles.kpiNegative}`}
          >
            {formatPercent(branch.roi, { forceSign: true })}
          </span>
          <span className={styles.kpiSub}>Growth: {formatPercent(branch.growthPercent, { forceSign: true })}</span>
        </div>
      </div>

      {/* 2. Revenue Trend & Profit Trend Charts */}
      <div className={styles.chartsGrid}>
        {/* Monthly Revenue Chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardHead}>
            <h4 className={styles.cardTitle}>Monthly Revenue Trend</h4>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
              Avg: {formatCrLakh(branch.revenue / branch.monthlyRevenue.length)}/mo
            </span>
          </div>

          <div className={styles.svgWrap}>
            <svg
              className={styles.chartSvg}
              viewBox="0 0 320 120"
              role="img"
              aria-label="Revenue Trend Bar Chart"
            >
              {branch.monthlyRevenue.map((item, idx) => {
                const count = branch.monthlyRevenue.length;
                const slotW = 320 / count;
                const barW = 24;
                const x = idx * slotW + (slotW - barW) / 2;
                const barH = (item.amount / maxRevenue) * 90;
                const y = 100 - barH;

                return (
                  <g key={item.month}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="3"
                      fill="#1a52c4"
                    >
                      <title>{`${item.month}: ${formatCrLakh(item.amount)}`}</title>
                    </rect>
                    <text
                      x={x + barW / 2}
                      y={y - 4}
                      fontSize="9"
                      fill="#121316"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {formatCrLakh(item.amount)}
                    </text>
                    <text
                      x={x + barW / 2}
                      y="114"
                      fontSize="10"
                      fill="#656a72"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {item.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Monthly Profit/Loss Trend Chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardHead}>
            <h4 className={styles.cardTitle}>Monthly Profit / Loss Trend</h4>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isProfit ? 'var(--success-fg)' : 'var(--danger-fg)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Net: {formatCrLakh(branch.profit, { forceSign: true })}
            </span>
          </div>

          <div className={styles.svgWrap}>
            <svg
              className={styles.chartSvg}
              viewBox="0 0 320 120"
              role="img"
              aria-label="Profit Trend Chart with Zero Axis"
            >
              {/* Zero baseline */}
              <line
                x1="10"
                x2="310"
                y1="60"
                y2="60"
                stroke="var(--border)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />

              {branch.monthlyProfit.map((item, idx) => {
                const count = branch.monthlyProfit.length;
                const slotW = 320 / count;
                const barW = 24;
                const x = idx * slotW + (slotW - barW) / 2;
                const isNeg = item.amount < 0;
                const barH = Math.max(3, (Math.abs(item.amount) / maxProfitVal) * 45);
                const y = isNeg ? 60 : 60 - barH;

                return (
                  <g key={item.month}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="3"
                      fill={isNeg ? '#b91c1c' : '#15803d'}
                    >
                      <title>{`${item.month}: ${formatCrLakh(item.amount, { forceSign: true })}`}</title>
                    </rect>
                    <text
                      x={x + barW / 2}
                      y={isNeg ? y + barH + 11 : y - 4}
                      fontSize="9"
                      fill={isNeg ? '#b91c1c' : '#15803d'}
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {formatCrLakh(item.amount, { forceSign: true })}
                    </text>
                    <text
                      x={x + barW / 2}
                      y="114"
                      fontSize="10"
                      fill="#656a72"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {item.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Expense Breakdown and Investment History Grid */}
      <div className={styles.detailGrid}>
        {/* Expense Breakdown */}
        <div className={styles.chartCard}>
          <div className={styles.cardHead}>
            <h4 className={styles.cardTitle}>Operational Expense Breakdown</h4>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Total: {formatCrLakh(branch.expenses)}
            </span>
          </div>

          <div className={styles.expenseBars}>
            {branch.expenseBreakdown.map((item) => (
              <div key={item.category} className={styles.expenseItem}>
                <div className={styles.expenseHeader}>
                  <span className={styles.expenseCategory}>{item.category}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
                      {item.percentage}%
                    </span>
                    <span className={styles.expenseFigure}>{formatCrLakh(item.amount)}</span>
                  </div>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color ?? 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment History Timeline */}
        <div className={styles.chartCard}>
          <div className={styles.cardHead}>
            <h4 className={styles.cardTitle}>Capital Injected &amp; Asset Timeline</h4>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Total: {formatCrLakh(branch.investment)}
            </span>
          </div>

          <div className={styles.timeline}>
            {branch.investmentHistory.map((m) => (
              <div key={m.title} className={styles.milestone}>
                <div className={styles.timelineDot} />
                <span className={styles.milestoneDate}>{m.date}</span>
                <div className={styles.milestoneHeader}>
                  <span className={styles.milestoneTitle}>{m.title}</span>
                  <span className={styles.milestoneAmount}>{formatCrLakh(m.amount)}</span>
                </div>
                <p className={styles.milestoneDesc}>{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Branch Partner Profit Distribution */}
      <div className={styles.chartCard}>
        <div className={styles.cardHead}>
          <h4 className={styles.cardTitle}>Branch Partner Dividend Distribution</h4>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            4 Equal Partners (25% each)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          {['Partner 1', 'Partner 2', 'Partner 3', 'Partner 4'].map((pName, index) => (
            <div
              key={pName}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-soft)',
                background: 'var(--paper-sunken)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: partnerColors[index],
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{pName}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>25%</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: partnerShareAmount >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)',
                }}
              >
                {formatCrLakh(partnerShareAmount, { forceSign: true })}
              </span>
              <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                {partnerShareAmount >= 0 ? 'Dividend payout' : 'Loss absorption requirement'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
