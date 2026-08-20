/**
 * Money formatting for display.
 *
 * Amounts arrive from the API as strings, because they are Decimal128 in the database and a figure
 * that must total exactly must not be rounded through a JS number on the way out. They stay strings
 * until the moment they are shown, which is here.
 *
 * Grouping follows the *reader's* locale, not the money's currency — an Indian user reads
 * 16,80,750.00 whether the figure is rupees or dollars — so the locale is left undefined and the
 * currency code only selects the symbol. Nothing about Indian formatting is hardcoded.
 */

/** Beyond this, a double can no longer hold two decimal places exactly. */
const MAX_EXACT = Number.MAX_SAFE_INTEGER / 100;

/**
 * `Intl.NumberFormat` construction is the expensive part, and a page of cards or a report table
 * formats hundreds of figures against a handful of currencies. Built once per currency and reused.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function formatterFor(currency?: string): Intl.NumberFormat {
  const key = currency ?? '';
  const cached = formatterCache.get(key);
  if (cached) return cached;

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(undefined, {
      ...(currency ? { style: 'currency', currency } : {}),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // An unrecognised currency code throws rather than degrading. A wrong symbol is a display
    // problem; a thrown error takes the whole screen down, so fall back to a bare number.
    formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatterCache.set(key, formatter);
  return formatter;
}

export interface FormatMoneyOptions {
  /** ISO 4217 code, e.g. "INR". Adds the currency symbol; omit for a bare number. */
  currency?: string;
  /**
   * Render negatives as (1,234.00) rather than -1,234.00 — the accounting convention, and the
   * default here because every figure this app shows is an accounting figure.
   */
  accounting?: boolean;
}

/**
 * Formats an amount for display. Returns the input unchanged if it is not a finite number, so a
 * malformed figure shows as itself rather than as "NaN".
 */
export function formatMoney(value: string | number, options: FormatMoneyOptions = {}): string {
  const { currency, accounting = true } = options;

  // Blank and null must be caught before the conversion, not after: Number('') and Number(null)
  // are both 0, which would render a missing amount as a confident 0.00 balance.
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return '—';
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return typeof value === 'string' ? value : '—';
  }

  // Past the safe range the grouped output would be quietly wrong. Showing the raw figure is worse
  // to read but is at least the number the books actually hold.
  if (Math.abs(numeric) > MAX_EXACT) {
    return String(value);
  }

  const magnitude = formatterFor(currency).format(Math.abs(numeric));

  if (numeric < 0) {
    return accounting ? `(${magnitude})` : `-${magnitude}`;
  }
  return magnitude;
}

/**
 * The same figure labelled with the side it falls on, as a ledger shows it. Debit-positive input,
 * matching every amount the reports API returns.
 */
export function formatMoneyWithSide(
  value: string | number,
  options: FormatMoneyOptions = {},
): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return formatMoney(value, options);
  }

  // The side already carries the sign, so the magnitude is shown unsigned.
  const magnitude = formatMoney(Math.abs(numeric), options);
  return `${magnitude} ${numeric < 0 ? 'Cr' : 'Dr'}`;
}
