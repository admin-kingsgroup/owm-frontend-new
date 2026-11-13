import { useState } from 'react';
import { Send, Ban, Pencil } from 'lucide-react';

import { postVoucher, cancelVoucher } from '@/entities/voucher';
import type { Voucher } from '@/entities/voucher';
import { Button, ConfirmDialog, toast } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './VoucherActions.module.css';

export interface VoucherActionsProps {
  companyId: string;
  voucher: Voucher;
  onChanged: (voucher: Voucher) => void;
  /**
   * Opens the voucher for editing — a draft, or a posted one in place, the way Tally allows. The
   * form lives with whoever owns this screen, so this only asks for it; leaving it out hides the
   * button.
   */
  onEdit?: (voucher: Voucher) => void;
  /**
   * Called instead of `onChanged` when cancelling a draft: the server deletes a draft outright
   * rather than marking it cancelled, so there is no voucher left to show.
   */
  onDiscarded?: (voucher: Voucher) => void;
}

export function VoucherActions({
  companyId,
  voucher,
  onChanged,
  onEdit,
  onDiscarded,
}: VoucherActionsProps) {
  const [pending, setPending] = useState<'post' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Whether the reader is being asked to confirm cancelling this voucher. */
  const [confirming, setConfirming] = useState(false);

  async function handlePost() {
    setPending('post');
    setError(null);
    try {
      const updated = await postVoucher(companyId, voucher.id);
      onChanged(updated);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not post voucher'));
    } finally {
      setPending(null);
    }
  }

  async function handleCancel() {
    setPending('cancel');
    setError(null);
    try {
      const updated = await cancelVoucher(companyId, voucher.id);
      setConfirming(false);
      if (voucher.status === 'DRAFT') {
        // A draft is deleted, not kept as cancelled — it never touched the books.
        (onDiscarded ?? onChanged)(updated);
        toast.success(`Draft ${voucher.voucherNumber} discarded.`);
      } else {
        onChanged(updated);
        toast.success(`Voucher ${voucher.voucherNumber} cancelled.`);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cancel voucher'));
    } finally {
      setPending(null);
    }
  }

  if (voucher.status === 'CANCELLED') {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onEdit(voucher)}
            disabled={pending !== null}
          >
            <Pencil size={14} /> Edit voucher
          </Button>
        )}
        {voucher.status === 'DRAFT' && (
          <Button type="button" variant="primary" onClick={handlePost} disabled={pending !== null}>
            <Send size={14} /> {pending === 'post' ? 'Posting…' : 'Post voucher'}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(true)}
          disabled={pending !== null}
        >
          <Ban size={14} /> {pending === 'cancel' ? 'Cancelling…' : 'Cancel voucher'}
        </Button>
      </div>

      {/*
        Replaces window.confirm(). Cancelling a posted voucher takes it out of every statement it
        appears in, which is worth saying in more than the one line that box allowed — and worth a
        button that says "Cancel voucher" rather than "OK" beside one that says "Cancel", which is
        the pair the browser dialog offered for this particular action.
      */}
      <ConfirmDialog
        open={confirming}
        destructive
        busy={pending === 'cancel'}
        title={`Cancel voucher ${voucher.voucherNumber}?`}
        consequence="This cannot be undone."
        confirmLabel="Cancel voucher"
        cancelLabel="Keep voucher"
        onConfirm={handleCancel}
        onCancel={() => setConfirming(false)}
      >
        The voucher stays in the register marked cancelled, and its amounts come out of every
        statement they currently appear in.
      </ConfirmDialog>
    </div>
  );
}
