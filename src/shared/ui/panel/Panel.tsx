import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './Panel.module.css';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** The heading. Omitted entirely for a panel that is only a surface. */
  title?: ReactNode;
  /** Controls that belong to this panel — a New button, a filter, a link to the full report. */
  actions?: ReactNode;
  /**
   * Drops the body's padding, for a panel whose body is one grid: the table then draws its rules
   * to the panel's edge rather than floating inside a ring of padding.
   */
  flush?: boolean;
  children: ReactNode;
}

/**
 * A titled box — the product's one card shape.
 *
 * The header is a recessed strip rather than a line of text in the body, so a column of panels
 * reads as a stack of named things at a glance rather than as prose that happens to be bold.
 */
export function Panel({
  title,
  actions,
  flush = false,
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section className={cn(styles.panel, className)} {...props}>
      {(title !== undefined || actions !== undefined) && (
        <div className={styles.header}>
          {title !== undefined && <h2 className={styles.title}>{title}</h2>}
          {actions !== undefined && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={cn(styles.body, flush && styles.flush)}>{children}</div>
    </section>
  );
}
