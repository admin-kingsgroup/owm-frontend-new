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
      {/* .panelTitle lays itself out; the wrapper it used to sit in asked for a `.panelHeader`
          that was never written, so it contributed nothing but a div. */}
      <h2 className={styles.panelTitle}>Every group, with its closing position</h2>
      {groupSummary.length === 0 ? (
        <p className={styles.empty}>This company has no account groups yet.</p>
      ) : (
        <ReportTree nodes={groupSummary} onSelectLedger={openLedger} formatAmount={money} />
      )}
    </section>
  );
}
