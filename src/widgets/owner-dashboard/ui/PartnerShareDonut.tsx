import { useMemo, useState } from 'react';
import type { Business } from '@/entities/owner-portfolio';
import { calculatePartnerShare, formatCrLakh } from '@/entities/owner-portfolio';
import styles from './PartnerShareDonut.module.css';

interface PartnerShareDonutProps {
  businesses: Business[];
  selectedBusinessId?: string;
  onSelectBusiness?: (id: string) => void;
}

const PARTNER_COLORS = [
  '#1a52c4', // Blue
  '#2f7a72', // Teal
  '#6b4f9e', // Purple
  '#9a7b28', // Gold
];

export function PartnerShareDonut({
  businesses,
  selectedBusinessId,
  onSelectBusiness,
}: PartnerShareDonutProps) {
  const [internalSelectedBizId, setInternalSelectedBizId] = useState<string>('all');

  const currentBizId = selectedBusinessId ?? internalSelectedBizId;

  const currentBusiness = useMemo(() => {
    if (currentBizId === 'all') return null;
    return businesses.find((b) => b.id === currentBizId) ?? null;
  }, [businesses, currentBizId]);

  // Dynamic profit calculation
  const totalProfit = useMemo(() => {
    if (currentBusiness) {
      return currentBusiness.profit;
    }
    return businesses.reduce((sum, b) => sum + b.profit, 0);
  }, [businesses, currentBusiness]);

  const numberOfPartners = 4;
  const partnerShareAmount = calculatePartnerShare(totalProfit, numberOfPartners);
  const isLoss = totalProfit < 0;

  // SVG Donut (4 equal 25% segments)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const quarterDash = circumference * 0.25;

  const partnerNames = ['Partner 1', 'Partner 2', 'Partner 3', 'Partner 4'];

  const rows = useMemo(() => {
    return partnerNames.map((name, index) => ({
      name,
      sharePercent: 25,
      amount: partnerShareAmount,
      color: PARTNER_COLORS[index % PARTNER_COLORS.length],
    }));
  }, [partnerShareAmount]);

  function handleBusinessChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setInternalSelectedBizId(value);
    onSelectBusiness?.(value);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.topControlRow}>
        <div className={styles.businessSelector}>
          <label htmlFor="partner-biz-select" className={styles.selectLabel}>
            Distribution for:
          </label>
          <select
            id="partner-biz-select"
            className={styles.selectInput}
            value={currentBizId}
            onChange={handleBusinessChange}
          >
            <option value="all">Entire Portfolio (Combined)</option>
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.summaryTotal}>
          <span className={styles.totalLabel}>
            {isLoss ? 'Total Loss to Share:' : 'Total Business Profit:'}
          </span>
          <span
            className={`${styles.totalValue} ${isLoss ? styles.lossNegative : styles.profitPositive}`}
          >
            {formatCrLakh(totalProfit, { forceSign: true })}
          </span>
        </div>
      </div>

      <div className={styles.chartAndTable}>
        <div className={styles.donutContainer}>
          <svg className={styles.svg} viewBox="0 0 100 100" role="img" aria-label="Partner Equal Share Donut">
            {rows.map((row, index) => {
              const offset = -(index * quarterDash);
              return (
                <circle
                  key={row.name}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={row.color}
                  strokeWidth="16"
                  strokeDasharray={`${quarterDash} ${circumference}`}
                  strokeDashoffset={offset}
                >
                  <title>{`${row.name}: 25% (${formatCrLakh(row.amount, { forceSign: true })})`}</title>
                </circle>
              );
            })}
          </svg>

          <div className={styles.centerText}>
            <span className={styles.centerPercent}>25%</span>
            <span className={styles.centerSub}>Per Partner</span>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Partner</th>
              <th>Ownership</th>
              <th>{isLoss ? 'Loss Share' : 'Profit Amount'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td className={styles.partnerNameCell}>
                  <span className={styles.partnerDot} style={{ backgroundColor: row.color }} />
                  <span>{row.name}</span>
                </td>
                <td className={styles.monoCol}>{row.sharePercent}%</td>
                <td
                  className={`${styles.monoCol} ${row.amount < 0 ? styles.lossNegative : styles.profitPositive}`}
                  style={{ fontWeight: 600 }}
                >
                  {formatCrLakh(row.amount, { forceSign: true })}
                  {row.amount < 0 && <span className={styles.lossBadge}>Loss Contribution</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
