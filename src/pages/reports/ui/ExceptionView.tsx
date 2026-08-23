import type { ExceptionReport } from '@/entities/report';
import { cn } from '@/shared/lib';

import styles from './ReportsPage.module.css';

interface ExceptionViewProps {
  report: ExceptionReport;
}

const KIND_LABELS: Record<string, string> = {
  TRIAL_BALANCE: 'Books do not tie',
  NEGATIVE_CASH: 'Overdrawn account',
  OVER_CREDIT_LIMIT: 'Over credit limit',
  UNPOSTED_DRAFT: 'Unposted draft',
  NO_NARRATION: 'No narration',
  LONG_OVERDUE: 'Long overdue',
};

/**
 * What is worth a second look before the books are signed off.
 *
 * Errors first, because one of them means a statement is wrong while the rest only mean a question
 * has not been asked. Nothing here blocks anything — it is a list somebody reads, not a gate, and
 * a book with open questions in it is entirely normal right up until the day it is signed.
 */
export function ExceptionView({ report }: ExceptionViewProps) {
  const ordered = [...report.exceptions].sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'ERROR' ? -1 : 1;
  });

  return (
    <section className={styles.panel}>
      <div className={styles.buckets}>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Errors</span>
          <span
            className={cn(styles.bucketAmount, report.totals.errors > 0 && styles.figureNegative)}
          >
            {report.totals.errors}
          </span>
          <span className={styles.bucketPrior}>a statement is wrong</span>
        </div>
        <div className={styles.bucket}>
          <span className={styles.bucketLabel}>Questions</span>
          <span className={styles.bucketAmount}>{report.totals.warnings}</span>
          <span className={styles.bucketPrior}>worth checking before signing</span>
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className={styles.empty}>
          Nothing to look at. The books tie, no account is overdrawn, and nothing is sitting
          unposted.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-stack>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Kind</th>
                <th>What it is</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((line, index) => (
                <tr key={`${line.kind}-${line.entityId ?? index}`}>
                  <td className={line.severity === 'ERROR' ? styles.figureNegative : undefined}>
                    {line.severity === 'ERROR' ? 'Error' : 'Question'}
                  </td>
                  <td>{KIND_LABELS[line.kind] ?? line.kind}</td>
                  <td>{line.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.totals.omitted > 0 && (
        <p className={styles.hint}>
          {report.totals.omitted} more question{report.totals.omitted === 1 ? '' : 's'} of the same
          kinds are not listed. Every error is, always — this only holds back the ones that grow
          with the number of vouchers, which would otherwise bury the handful worth reading.
        </p>
      )}
    </section>
  );
}
