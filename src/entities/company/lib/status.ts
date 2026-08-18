import type { BadgeVariant } from '@/shared/ui';

import type { CompanyStatus } from '../model/types';

export function companyStatusVariant(status: CompanyStatus): BadgeVariant {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}
