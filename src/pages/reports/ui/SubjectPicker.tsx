import styles from './ReportsPage.module.css';

interface SubjectPickerProps {
  /** Used for the label's `htmlFor` and as the control's id, so the two cannot drift apart. */
  id: string;
  label: string;
  value: string;
  /**
   * `group` puts an option under a heading. Used where one picker offers two kinds of thing — a
   * monthly summary reads either a ledger or a whole group, and a flat list of both mixed together
   * gives no way to tell which is which when the names are similar.
   */
  options: Array<{ value: string; label: string; group?: string }>;
  /** Shown as the first option while nothing is chosen. */
  placeholder: string;
  onChange: (value: string) => void;
}

/**
 * Chooses what a report is about — which ledger, which voucher type, which group.
 *
 * Several reports answer a question about one thing rather than about the whole company, and
 * before this the only way to reach them was to click a row inside another report. That works once
 * you are already looking at the right statement, and not at all when the ledger you want has no
 * movement this year to click on.
 *
 * The choice goes into the address beside the period, so a particular ledger's statement can be
 * bookmarked and sent the same way any other report can.
 */
export function SubjectPicker({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: SubjectPickerProps) {
  /* Headings in the order they first appear, so the caller decides which kind is listed first. */
  const grouped: Array<[string, SubjectPickerProps['options']]> = [];
  for (const option of options) {
    if (!option.group) continue;
    const existing = grouped.find(([heading]) => heading === option.group);
    if (existing) existing[1].push(option);
    else grouped.push([option.group, [option]]);
  }

  return (
    <div className={styles.periodField}>
      <label className={styles.periodLabel} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {grouped.length === 0
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : grouped.map(([heading, entries]) => (
              <optgroup key={heading} label={heading}>
                {entries.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
    </div>
  );
}
