import { formatMoney } from '@/shared/lib';

/** The fields that hold an amount — formatted as money, and aligned as figures. */
const MONEY_FIELDS = new Set(['subtotal', 'tax_amount', 'total_amount', 'unit_price', 'amount']);

export function isMoneyField(field: string): boolean {
  return MONEY_FIELDS.has(field);
}

/** "seller_tax_id" → "Seller tax ID". */
export function fieldLabel(field: string): string {
  const words = field.replace(/_/g, ' ').replace(/\bid\b/g, 'ID');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isNumeric(value: string | null): boolean {
  return value !== null && /^-?\d+(\.\d+)?$/.test(value.trim());
}

/**
 * An amount for display, in the document's own currency when it printed one.
 *
 * Rupee figures are grouped the Indian way (1,25,000.00) and every other currency in millions
 * (125,000.00). Without a printed currency there is no symbol to show — the server never guesses
 * one — so the figure is grouped the reader's own way.
 */
export function formatAmount(value: string, currency: string | null | undefined): string {
  if (!isNumeric(value)) return value;
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  const country = code === 'INR' ? 'IN' : code ? 'US' : undefined;
  return formatMoney(value, { currency: code, country, accounting: false });
}

/** A field's value as it should read in a table: money formatted, anything else as extracted. */
export function displayValue(
  field: string,
  value: string | null,
  currency: string | null | undefined,
): string {
  if (value === null) return '—';
  return isMoneyField(field) ? formatAmount(value, currency) : value;
}

export function documentTypeLabel(type: string | null | undefined): string {
  return type ? fieldLabel(type) : '—';
}
