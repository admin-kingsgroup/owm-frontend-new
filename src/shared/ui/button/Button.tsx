import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/shared/lib';

import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button className={cn(styles.button, styles[variant], className)} {...props} />;
}
