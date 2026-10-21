import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** Shown under the label — for settings whose consequence is not obvious from the name. */
  hint?: ReactNode;
  /**
   * Drawn as an on/off switch, label first and the switch at the far end — for a setting that is
   * on or off rather than an item ticked in a list. Still a checkbox underneath, so a form and a
   * test read it the same way; announced as a switch, which is what it now looks like.
   */
  switchStyle?: boolean;
}

/**
 * Wraps the input in its own label so the whole row is a hit target, which matters for the
 * settings screens where these appear in a list.
 */
export function Checkbox({
  label,
  hint,
  className,
  id,
  switchStyle = false,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        styles.row,
        switchStyle && styles.switchRow,
        props.disabled && styles.disabled,
        className,
      )}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        role={switchStyle ? 'switch' : undefined}
        className={cn(styles.input, switchStyle && styles.switch)}
        {...props}
      />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}
