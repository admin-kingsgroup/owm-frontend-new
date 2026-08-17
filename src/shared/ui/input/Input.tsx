import type { InputHTMLAttributes } from 'react';

import { cn } from '@/shared/lib';

import styles from './Input.module.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(styles.input, className)} {...props} />;
}
