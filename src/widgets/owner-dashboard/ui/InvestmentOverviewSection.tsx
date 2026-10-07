import type { Business, PortfolioTotals } from '@/entities/owner-portfolio';
import { formatCrLakh, formatPercent } from '@/entities/owner-portfolio';
import { InvestmentAllocationDonut } from './InvestmentAllocationDonut';
import styles from './InvestmentOverviewSection.module.css';

interface InvestmentOverviewSectionProps {
  businesses: Business[];
  totals: PortfolioTotals;
}

export function InvestmentOverviewSection({
  businesses,
  totals,
}: InvestmentOverviewSectionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Investment Overview &amp; Asset Allocation</h2>
        </div>
        <span className={styles.subtitle}>
          Deployment of ₹12.8 Cr capital across commercial entities and growth vehicles
        </span>
      </div>

      <div className={styles.card}>
        <InvestmentAllocationDonut
          businesses={businesses}
          totalInvestment={totals.totalInvestment}
          currentValue={totals.currentValue}
        />
      </div>

      {/* Capital Schedule Table */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Business Entity</th>
              <th>Initial Investment</th>
              <th>Additional Capital</th>
              <th>Total Invested</th>
              <th>Portfolio Weight</th>
              <th>Current Valuation</th>
              <th>Total Return</th>
              <th>Net Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((biz) => {
              const ret = biz.currentValue - biz.investment;
              return (
                <tr key={biz.id}>
                  <td style={{ fontWeight: 600 }}>{biz.name}</td>
                  <td className={styles.mono}>{formatCrLakh(biz.initialInvestment)}</td>
                  <td className={styles.mono}>{formatCrLakh(biz.additionalInvestment)}</td>
                  <td className={styles.monoBold}>{formatCrLakh(biz.investment)}</td>
                  <td className={styles.mono}>{biz.allocationPercent.toFixed(0)}%</td>
                  <td className={styles.monoBold}>{formatCrLakh(biz.currentValue)}</td>
                  <td
                    className={styles.mono}
                    style={{ color: ret >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)', fontWeight: 600 }}
                  >
                    {formatCrLakh(ret, { forceSign: true })}
                  </td>
                  <td
                    className={styles.mono}
                    style={{ color: biz.profit >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)', fontWeight: 600 }}
                  >
                    {formatCrLakh(biz.profit, { forceSign: true })} ({formatPercent(biz.roi, { forceSign: true })})
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--paper-sunken)', fontWeight: 700 }}>
              <td>Portfolio Total</td>
              <td className={styles.mono}>{formatCrLakh(totals.initialInvestmentTotal)}</td>
              <td className={styles.mono}>{formatCrLakh(totals.additionalInvestmentTotal)}</td>
              <td className={styles.mono}>{formatCrLakh(totals.totalInvestment)}</td>
              <td className={styles.mono}>100%</td>
              <td className={styles.mono}>{formatCrLakh(totals.currentValue)}</td>
              <td className={styles.mono} style={{ color: 'var(--success-fg)' }}>
                {formatCrLakh(totals.totalReturn, { forceSign: true })}
              </td>
              <td className={styles.mono} style={{ color: 'var(--success-fg)' }}>
                {formatCrLakh(totals.totalProfit, { forceSign: true })} ({formatPercent(totals.profitRoiPercent, { forceSign: true })})
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
