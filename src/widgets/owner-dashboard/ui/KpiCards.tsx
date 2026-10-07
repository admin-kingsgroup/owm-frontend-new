import {
  TrendingUp,
  Wallet,
  Building,
  DollarSign,
  Receipt,
  UserCheck,
} from 'lucide-react';
import type { PortfolioTotals } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import styles from './KpiCards.module.css';

interface KpiCardsProps {
  totals: PortfolioTotals;
}

export function KpiCards({ totals }: KpiCardsProps) {
  return (
    <div className={styles.grid}>
      {/* 1. Total Investment */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Total Investment</span>
          <div className={styles.iconWrap}>
            <Wallet size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.value}>{formatCrLakh(totals.totalInvestment)}</span>
        </div>
        <div className={styles.footer}>
          <span className={`${styles.trend} ${styles.trendPositive}`}>
            <TrendingUp size={12} /> +{totals.investmentChangePercent}%
          </span>
          <span className={styles.supporting}>Capital invested</span>
        </div>
      </div>

      {/* 2. Current Business Value */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Current Business Value</span>
          <div className={styles.iconWrap}>
            <Building size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.value}>{formatCrLakh(totals.currentValue)}</span>
        </div>
        <div className={styles.footer}>
          <span className={`${styles.trend} ${styles.trendPositive}`}>
            <TrendingUp size={12} /> +{totals.valueGrowthPercent}%
          </span>
          <span className={styles.supporting}>Combined valuation</span>
        </div>
      </div>

      {/* 3. Total Profit */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Total Profit</span>
          <div className={styles.iconWrap}>
            <TrendingUp size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span
            className={styles.value}
            style={{ color: totals.totalProfit >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}
          >
            {formatCrLakh(totals.totalProfit, { forceSign: true })}
          </span>
        </div>
        <div className={styles.footer}>
          <span className={`${styles.trend} ${totals.totalProfit >= 0 ? styles.trendPositive : styles.trendNegative}`}>
            ROI: {totals.profitRoiPercent.toFixed(1)}%
          </span>
          <span className={styles.supporting}>Overall yield</span>
        </div>
      </div>

      {/* 4. Total Revenue */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Total Revenue</span>
          <div className={styles.iconWrap}>
            <DollarSign size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.value}>{formatCrLakh(totals.totalRevenue)}</span>
        </div>
        <div className={styles.footer}>
          <span className={styles.supporting}>Gross turnover across 5 companies</span>
        </div>
      </div>

      {/* 5. Total Expenses */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Total Expenses</span>
          <div className={styles.iconWrap}>
            <Receipt size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span className={styles.value}>{formatCrLakh(totals.totalExpenses)}</span>
        </div>
        <div className={styles.footer}>
          <span className={styles.supporting}>Operational &amp; capital costs</span>
        </div>
      </div>

      {/* 6. Owner's Share */}
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.title}>Owner&apos;s Share</span>
          <div className={styles.iconWrap}>
            <UserCheck size={16} />
          </div>
        </div>
        <div className={styles.valueContainer}>
          <span
            className={styles.value}
            style={{ color: totals.ownerShare >= 0 ? 'var(--accent)' : 'var(--danger-fg)' }}
          >
            {formatCrLakh(totals.ownerShare, { forceSign: true })}
          </span>
        </div>
        <div className={styles.footer}>
          <span className={styles.trend} style={{ color: 'var(--accent)' }}>
            25% Equal Share
          </span>
          <span className={styles.supporting}>Of ₹4.6 Cr net profit</span>
        </div>
      </div>
    </div>
  );
}
