import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { Business, Branch } from '@/entities/owner-portfolio';
import { calculateInsights } from '@/entities/owner-portfolio';
import styles from './BusinessInsightsSection.module.css';

interface BusinessInsightsSectionProps {
  businesses: Business[];
  branches: Branch[];
}

export function BusinessInsightsSection({
  businesses,
  branches,
}: BusinessInsightsSectionProps) {
  const insights = calculateInsights(businesses, branches);

  if (insights.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Business Insights</h3>
          <span className={styles.countBadge}>{insights.length} active</span>
        </div>
      </div>

      <div className={styles.grid}>
        {insights.map((insight) => {
          let icon = <Info size={14} />;
          let iconClass = styles.iconInfo;

          if (insight.type === 'positive') {
            icon = <CheckCircle2 size={14} />;
            iconClass = styles.iconPositive;
          } else if (insight.type === 'warning') {
            icon = <AlertTriangle size={14} />;
            iconClass = styles.iconWarning;
          }

          return (
            <div key={insight.id} className={styles.card}>
              <div className={`${styles.iconWrapper} ${iconClass}`}>{icon}</div>
              <div className={styles.content}>
                <span className={styles.cardTitle}>{insight.title}</span>
                <span className={styles.cardText}>{insight.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
