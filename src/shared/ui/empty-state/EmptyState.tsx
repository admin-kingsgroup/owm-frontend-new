import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon = <Inbox size={32} />, title, description }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>{icon}</div>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
