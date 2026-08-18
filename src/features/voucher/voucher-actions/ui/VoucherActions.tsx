import { useState } from 'react';
import { Send, Ban } from 'lucide-react';

import { postVoucher, cancelVoucher } from '@/entities/voucher';
import type { Voucher } from '@/entities/voucher';
import { Button } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './VoucherActions.module.css';

export interface VoucherActionsProps {
  companyId: string;
  voucher: Voucher;
  onChanged: (voucher: Voucher) => void;
}

export function VoucherActions({ companyId, voucher, onChanged }: VoucherActionsProps) {
  const [pending, setPending] = useState<'post' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!window.confirm(`Cancel voucher ${voucher.voucherNumber}? This cannot be undone.`)) {
      return;
    }

    setPending('cancel');
    setError(null);
    try {
      const updated = await cancelVoucher(companyId, voucher.id);
      onChanged(updated);
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
        {voucher.status === 'DRAFT' && (
          <Button type="button" variant="primary" onClick={handlePost} disabled={pending !== null}>
            <Send size={14} /> {pending === 'post' ? 'Posting…' : 'Post voucher'}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleCancel} disabled={pending !== null}>
          <Ban size={14} /> {pending === 'cancel' ? 'Cancelling…' : 'Cancel voucher'}
        </Button>
      </div>
    </div>
  );
}
