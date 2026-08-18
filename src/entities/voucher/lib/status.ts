import type { BadgeVariant } from '@/shared/ui';

import type { VoucherStatus } from '../model/types';

export function voucherStatusVariant(status: VoucherStatus): BadgeVariant {
  switch (status) {
    case 'POSTED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    case 'DRAFT':
    default:
      return 'warning';
  }
}
