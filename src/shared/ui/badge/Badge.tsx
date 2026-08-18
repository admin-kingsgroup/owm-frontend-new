import type { ReactNode } from 'react';

import { cn } from '@/shared/lib';

import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={cn(styles.badge, styles[variant])}>{children}</span>;
}
