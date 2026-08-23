import type { ReportNode } from '@/entities/report';

import { ReportTree } from './ReportTree';
import styles from './ReportsPage.module.css';

interface GroupSummaryViewProps {
  groups: ReportNode[];
  /** Formats an amount the way the company writes money. */
  money: (value: string) => string;
  /** Opens the ledger behind a row. */
  openLedger: (node: ReportNode) => void;
}

/** Every account group with its closing position, as the tree the chart of accounts describes. */
export function GroupSummaryView({
  groups: groupSummary,
  money,
  openLedger,
}: GroupSummaryViewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Every group, with its closing position</span>
      </div>
      {groupSummary.length === 0 ? (
        <p className={styles.empty}>This company has no account groups yet.</p>
      ) : (
        <ReportTree nodes={groupSummary} onSelectLedger={openLedger} formatAmount={money} />
      )}
    </section>
  );
}
