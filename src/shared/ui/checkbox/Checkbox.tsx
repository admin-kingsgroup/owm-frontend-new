import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  /** Shown under the label — for settings whose consequence is not obvious from the name. */
  hint?: ReactNode;
}

/**
 * Wraps the input in its own label so the whole row is a hit target, which matters for the
 * settings screens where these appear in a list.
 */
export function Checkbox({ label, hint, className, id, ...props }: CheckboxProps) {
  return (
    <label className={cn(styles.row, props.disabled && styles.disabled, className)} htmlFor={id}>
      <input id={id} type="checkbox" className={styles.input} {...props} />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}
