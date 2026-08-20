import type { NumberingConfig } from '@/entities/voucher-type';

/**
 * A voucher type's counter for one reset period, with the settings it renders through.
 *
 * Read-only: the settings belong to the voucher type and are edited there, so a monthly series
 * cannot end up with twelve copies of its own prefix disagreeing with each other.
 */
export interface NumberSeries {
  id: string;
  companyId: string;
  voucherTypeId: string;
  voucherTypeCode: string;
  voucherTypeName: string;
  financialYear: string;
  periodKey: string;
  currentNumber: number;
  numbering: NumberingConfig;
  /** What the next number from this counter will be — composed by the server, so authoritative. */
  samplePreview: string;
  /** Whether numbers from this series could legally appear on a GST invoice. */
  gstCompliant: boolean;
  /** Why not, ready to show. Empty when it is compliant. */
  gstReason: string;
}
