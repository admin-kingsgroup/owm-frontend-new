import type { ButtonHTMLAttributes, Ref } from 'react';

import { cn } from '@/shared/lib';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Passed straight to the <button> — a form that submits through a particular button needs it. */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button className={cn(styles.button, styles[variant], className)} {...props} />;
}
