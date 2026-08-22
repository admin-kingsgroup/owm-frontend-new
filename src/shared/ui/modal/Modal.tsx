import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/shared/lib';
import { useFocusTrap } from '@/shared/hooks';

import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /**
   * How much room the dialog needs. 'default' is a form of stacked fields; 'wide' is for a dialog
   * holding a table — voucher entry is a grid of ledger, balance, debit and credit, and squeezing
   * those into a 28rem box leaves every column too narrow to read. Sizing is ignored below 40rem,
   * where every dialog is already a full-width sheet.
   */
  size?: 'default' | 'wide';
  children: ReactNode;
}

export function Modal({ open, onClose, title, size = 'default', children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /*
    Tab used to walk straight out of the dialog and into the page behind it, which is still there
    and still being read out while the dialog covers it. This also locks page scroll — on a phone
    the sheet was scrolling the list underneath instead of itself. Shared with the navigation
    drawer, which is the same problem.
  */
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={cn(styles.modal, size === 'wide' && styles.wide)}
        role="dialog"
        aria-modal="true"
        /*
          A dialog with no accessible name is announced as just "dialog", which tells a screen
          reader user that something opened and nothing about what. Every caller passes a title,
          so point at it; the fallback is only for one that does not.
        */
        {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': 'Dialog' })}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          {title && (
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          )}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
