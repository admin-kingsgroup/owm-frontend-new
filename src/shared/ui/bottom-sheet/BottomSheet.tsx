import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { useFocusTrap } from '@/shared/hooks';

import styles from './BottomSheet.module.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Its accessible name, and the heading drawn under the grab handle when `showTitle`. */
  title: string;
  showTitle?: boolean;
  children: ReactNode;
}

/**
 * A panel that slides up from the bottom of a phone — the More menu, the Create list, the company
 * switcher. Within thumb reach, which is the reason it is a sheet and not a dropdown from the top.
 *
 * Tapping the dimmed page or pressing Escape closes it. Focus stays inside while it is open and the
 * page behind does not scroll (useFocusTrap).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  showTitle = false,
  children,
}: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={ref}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className={styles.handle} aria-hidden="true" />
        {showTitle && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
