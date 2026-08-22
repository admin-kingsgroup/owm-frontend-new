import styles from './ReportsPage.module.css';

interface MonthlyFiguresProps {
  /** One label per month, already written the way the company writes dates. */
  labels: string[];
  /**
   * The same series the chart above is drawing. `null` means the month has no such figure at all —
   * a comparison year that had nothing that month — and is printed as a dash rather than a nil.
   */
  series: Array<{ label: string; values: Array<number | null> }>;
  /** Formats an amount the way the company writes money. */
  format: (value: number) => string;
}

/**
 * The figures behind the chart above it.
 *
 * A column chart is scaled by its largest bar, so one exceptional month flattens every other one
 * into a sliver — the shape stays honest but the detail is gone, and no amount of axis labelling
 * brings it back. The table is the answer to that: the chart carries the shape, this carries the
 * numbers, and neither has to pretend to do the other's job. It is also what makes a printed
 * report useful, where a reader cannot hover anything.
 */
export function MonthlyFigures({ labels, series, format }: MonthlyFiguresProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} data-stack>
        <thead>
          <tr>
            <th>Month</th>
            {series.map((entry) => (
              <th key={entry.label} className={styles.num}>
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label}>
              <td>{label}</td>
              {series.map((entry) => {
                const value = entry.values[index];
                return (
                  <td key={entry.label} className={styles.num}>
                    {value === null || value === undefined ? '—' : format(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
