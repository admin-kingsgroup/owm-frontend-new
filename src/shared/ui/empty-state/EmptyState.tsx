import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action rendered under the description — e.g. the button that resolves it. */
  action?: ReactNode;
}

export function EmptyState({
  icon = <Inbox size={32} />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon}>{icon}</div>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
