import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * What the control does, in words.
   *
   * Required, and it becomes both the accessible name and the tooltip — an icon-only button
   * without one is announced as "button" and nothing else. Name the object too: "Delete ledger"
   * beats "Delete" on a row among forty of them.
   */
  label: string;
  /**
   * Overrides the tooltip where the label is not the useful thing to say — a disabled control
   * wants to explain why it is disabled ("System ledgers cannot be deleted") rather than repeat
   * the action it is refusing to perform.
   */
  title?: string;
  variant?: 'default' | 'danger';
  children: ReactNode;
}

/**
 * A control that is only an icon.
 *
 * Reaches the 44px floor on a touchscreen through the `pointer: coarse` rule in globals.css, which
 * is keyed on what you are pointing with rather than how wide the window is — a small touchscreen
 * and a large one both need the bigger target, and a narrow desktop window does not.
 */
export function IconButton({
  label,
  title,
  variant = 'default',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(styles.iconButton, variant === 'danger' && styles.danger, className)}
      /*
        The label always names the control, whatever the tooltip says. A disabled delete explaining
        "System ledgers cannot be deleted" on hover is still "Delete ledger" to a screen reader,
        which needs to know what the control is before it is told why it will not work.
      */
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      {children}
    </button>
  );
}

/** The row-actions cluster — keeps adjacent targets from merging under a thumb. */
export function IconButtonGroup({ children }: { children: ReactNode }) {
  return <span className={styles.group}>{children}</span>;
}
