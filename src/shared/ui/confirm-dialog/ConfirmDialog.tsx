import type { ReactNode } from 'react';

import { cn } from '@/shared/lib';
import { Button } from '../button';
import { Modal } from '../modal';

import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  /** The question, as a title. "Delete ledger “Meridian Textiles”?" — name the thing. */
  title: string;
  /** What is about to happen, in a sentence or two. */
  children?: ReactNode;
  /** What cannot be undone. Drawn apart from the rest, because it is the part that decides. */
  consequence?: ReactNode;
  /**
   * The verb, on the button that performs it.
   *
   * "Delete ledger", never "OK". A reader who has stopped reading and is looking only at the
   * buttons should still be able to tell which one does the thing.
   */
  confirmLabel: string;
  /** What the other button says. "Cancel" is rarely the clearest word available. */
  cancelLabel?: string;
  /** Whether this destroys something. Draws the confirming button in the danger colour. */
  destructive?: boolean;
  /** Set while the action is in flight — both buttons hold still rather than the dialog vanishing. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before something irreversible happens.
 *
 * This replaces `window.confirm()`, which seven paths across the product used to call. That box
 * ignores the theme, ignores the type scale, renders any explanation as one run of text, and
 * labels the destructive choice "OK" — so the only thing distinguishing "delete this ledger
 * forever" from "keep it" was which of two identical grey buttons the reader happened to be over.
 *
 * The worst of the seven handed it three paragraphs weighing deactivating a business against
 * deleting its reported figures; see BusinessesPanel, which now asks that as its own question.
 *
 * Focus starts on the Modal's own close button, which renders ahead of this content — see
 * useFocusTrap, which takes the first focusable element in the dialog. That is the right place for
 * it: the dialog is reached by pressing a delete icon, and the next key pressed should not be the
 * one that completes it.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  consequence,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className={styles.body}>
        {children !== undefined && <p className={styles.message}>{children}</p>}
        {consequence !== undefined && <p className={styles.consequence}>{consequence}</p>}

        <div className={styles.actions}>
          {/*
            Ahead of the confirming button, so Tab reaches the safe choice first. `column-reverse`
            on a phone draws it below rather than above, where the thumb rests.
          */}
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'secondary' : 'primary'}
            className={cn(destructive && styles.danger)}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
