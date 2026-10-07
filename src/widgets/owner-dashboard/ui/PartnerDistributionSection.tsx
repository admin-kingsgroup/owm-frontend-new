import type { Business } from '@/entities/owner-portfolio';
import { formatCrLakh, calculatePartnerShare } from '@/entities/owner-portfolio';
import { PartnerShareDonut } from './PartnerShareDonut';
import styles from './PartnerDistributionSection.module.css';

interface PartnerDistributionSectionProps {
  businesses: Business[];
  selectedBusinessId?: string;
  onSelectBusiness?: (id: string) => void;
}

export function PartnerDistributionSection({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
}: PartnerDistributionSectionProps) {
  const totalPortfolioProfit = businesses.reduce((sum, b) => sum + b.profit, 0);
  const totalPerPartner = calculatePartnerShare(totalPortfolioProfit, 4);

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Partner Profit Distribution</h2>
        </div>
        <span className={styles.subtitle}>
          Equal 25% equity dividend split across all 4 stakeholders for every operating entity
        </span>
      </div>

      {/* 1. Visual Donut and Selected Business Breakdown */}
      <div className={styles.card}>
        <PartnerShareDonut
          businesses={businesses}
          selectedBusinessId={selectedBusinessId}
          onSelectBusiness={onSelectBusiness}
        />
      </div>

      {/* 2. Comprehensive 4-Partner Portfolio Matrix Table */}
      <div className={styles.matrixCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Business Entity</th>
              <th>Total Net Result</th>
              <th>Partner 1 (25%)</th>
              <th>Partner 2 (25%)</th>
              <th>Partner 3 (25%)</th>
              <th>Partner 4 (25%)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((biz) => {
              const share = calculatePartnerShare(biz.profit, 4);
              const isProfit = biz.profit >= 0;
              return (
                <tr key={biz.id}>
                  <td style={{ fontWeight: 600 }}>{biz.name}</td>
                  <td
                    className={`${styles.monoBold} ${isProfit ? styles.positive : styles.negative}`}
                  >
                    {formatCrLakh(biz.profit, { forceSign: true })}
                  </td>
                  <td
                    className={`${styles.mono} ${share >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatCrLakh(share, { forceSign: true })}
                  </td>
                  <td
                    className={`${styles.mono} ${share >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatCrLakh(share, { forceSign: true })}
                  </td>
                  <td
                    className={`${styles.mono} ${share >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatCrLakh(share, { forceSign: true })}
                  </td>
                  <td
                    className={`${styles.mono} ${share >= 0 ? styles.positive : styles.negative}`}
                  >
                    {formatCrLakh(share, { forceSign: true })}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        backgroundColor: isProfit ? 'var(--success-bg-soft)' : 'var(--danger-bg-soft)',
                        color: isProfit ? 'var(--success-fg)' : 'var(--danger-fg)',
                      }}
                    >
                      {isProfit ? 'Profit Distributed' : 'Loss Allocated'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--paper-sunken)', fontWeight: 700 }}>
              <td>Total Portfolio Distribution</td>
              <td className={`${styles.monoBold} ${totalPortfolioProfit >= 0 ? styles.positive : styles.negative}`}>
                {formatCrLakh(totalPortfolioProfit, { forceSign: true })}
              </td>
              <td className={`${styles.monoBold} ${totalPerPartner >= 0 ? styles.positive : styles.negative}`}>
                {formatCrLakh(totalPerPartner, { forceSign: true })}
              </td>
              <td className={`${styles.monoBold} ${totalPerPartner >= 0 ? styles.positive : styles.negative}`}>
                {formatCrLakh(totalPerPartner, { forceSign: true })}
              </td>
              <td className={`${styles.monoBold} ${totalPerPartner >= 0 ? styles.positive : styles.negative}`}>
                {formatCrLakh(totalPerPartner, { forceSign: true })}
              </td>
              <td className={`${styles.monoBold} ${totalPerPartner >= 0 ? styles.positive : styles.negative}`}>
                {formatCrLakh(totalPerPartner, { forceSign: true })}
              </td>
              <td style={{ fontSize: 11, color: 'var(--ink-faint)' }}>100% Balanced</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
