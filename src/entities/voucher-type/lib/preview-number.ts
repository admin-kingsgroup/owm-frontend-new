import type { NumberingConfig, ResetFrequency } from '../model/types';

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/**
 * The period stamp a number carries, mirroring the server's `numberPeriodKey`.
 *
 * A counter that restarts makes the serial alone ambiguous — serial 1 occurs in every period — so
 * the period is stamped into the number to keep it unique. `NEVER` prints nothing, because a
 * serial that never repeats needs nothing to disambiguate it.
 */
function periodToken(frequency: ResetFrequency, financialYearLabel: string, on: Date): string {
  const shortYear = financialYearLabel
    .split('-')
    .map((part) => part.slice(-2))
    .join('-');

  const month = on.getUTCMonth() + 1;
  const yy = String(on.getUTCFullYear()).slice(-2);

  switch (frequency) {
    case 'NEVER':
      return '';
    case 'YEARLY':
      return shortYear;
    case 'HALF_YEARLY':
      return `${shortYear}-H1`;
    case 'QUARTERLY':
      return `${shortYear}-Q1`;
    case 'MONTHLY':
      return `${yy}${pad(month)}`;
    case 'WEEKLY':
      return `${yy}W01`;
    case 'DAILY':
      return `${yy}${pad(month)}${pad(on.getUTCDate())}`;
  }
}

/**
 * What the next voucher number will look like under these settings.
 *
 * This is an illustration for the settings form, not the source of truth — the server composes the
 * number that actually gets issued, and `GET /number-series` reports the real next number for each
 * live counter. Quarter and half-year stamps here always show the first period, since the form has
 * no particular date in mind.
 */
export function previewVoucherNumber(
  config: NumberingConfig,
  companyCode: string,
  voucherTypeCode: string,
  financialYearLabel: string,
): string {
  const serialNumber = config.startingNumber;
  const serial = config.prefillWithZero
    ? pad(serialNumber, config.numberLength)
    : String(serialNumber);

  const parts = [
    config.numberFormat === 'TALLY_STYLE' ? null : companyCode,
    config.prefix || voucherTypeCode,
    periodToken(config.resetFrequency, financialYearLabel, new Date()) || null,
    serial,
    config.suffix || null,
  ];

  return parts.filter(Boolean).join('/');
}
