import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/shared/lib';

import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={styles.wrapper}>
      <select className={cn(styles.select, className)} {...props}>
        {children}
      </select>
      <ChevronDown className={styles.icon} size={16} />
    </div>
  );
}
