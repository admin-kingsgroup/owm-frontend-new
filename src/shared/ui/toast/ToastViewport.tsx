import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { cn } from '@/shared/lib';

import { dismissToast, useToasts } from './model';
import type { ToastTone } from './model';
import styles from './ToastViewport.module.css';

const ICON: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

/**
 * Where the product says what just happened. Mounted once, by the shell.
 *
 * One region, present in the DOM from the first render — a live region only announces what is
 * inserted into it after it exists, so a viewport that appears along with its first message
 * announces nothing at all.
 *
 * It is polite by default and each failure row carries `role="alert"` for itself, which is
 * assertive. Announcing a save the same way as a refusal teaches that neither is worth listening
 * to; interrupting for every save teaches that the product is shouting.
 */
export function ToastViewport() {
  const toasts = useToasts();

  return (
    <div className={styles.viewport} aria-live="polite">
      {toasts.map((entry) => {
        const Icon = ICON[entry.tone];

        return (
          <div
            key={entry.id}
            className={cn(styles.toast, styles[entry.tone])}
            {...(entry.tone === 'error' ? { role: 'alert' } : {})}
          >
            <Icon className={styles.icon} size={16} aria-hidden="true" />
            <span className={styles.message}>{entry.message}</span>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => dismissToast(entry.id)}
              aria-label="Dismiss message"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
