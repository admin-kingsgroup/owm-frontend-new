/**
 * Defaults offered when creating a company. They are form starting points, not constraints —
 * the backend stores currency, country, timezone and the financial-year range per company, and
 * every field stays editable. Collected here so a non-Indian deployment changes one file.
 */
export const COMPANY_DEFAULTS = {
  baseCurrency: 'INR',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  /** 1-based month the financial year opens on — 4 = April, the Indian convention. */
  financialYearStartMonth: 4,
} as const;
