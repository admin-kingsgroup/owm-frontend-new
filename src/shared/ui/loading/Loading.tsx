import { Loader2 } from 'lucide-react';

import styles from './Loading.module.css';

export interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Loading…' }: LoadingProps) {
  return (
    <div className={styles.wrapper} role="status">
      <Loader2 className={styles.spinner} size={20} />
      <span>{label}</span>
    </div>
  );
}
