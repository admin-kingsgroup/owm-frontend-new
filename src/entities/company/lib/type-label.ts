import type { CompanyType } from '../model/types';

/**
 * Plain words for the stored company type — the enum value is not what a person should read.
 *
 * Held once because three screens now print it: the selection list, the company screen's header,
 * and the dashboard header above every set of figures. It decides the whole chart of accounts and
 * cannot be changed after creation, so it has to stay visible; without it a personal ledger and a
 * trading company are indistinguishable once created.
 */
const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  TRADING: 'Trading business',
  PERSONAL: 'Personal wealth ledger',
  ANALYTICS: 'Portfolio analytics',
};

/** The stored value itself for a type this build does not know, rather than nothing at all. */
export function companyTypeLabel(type: CompanyType): string {
  return COMPANY_TYPE_LABELS[type] ?? type;
}
