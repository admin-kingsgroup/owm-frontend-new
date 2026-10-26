export interface Partner {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PartnerShare {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  profitSharePercent: string;
}

export interface Business {
  id: string;
  companyId: string;
  code: string;
  name: string;
  /** The currency the business keeps its own books in — they do not all share one. */
  reportingCurrency: string;
  partners: PartnerShare[];
  isActive: boolean;
}

export interface CreateBusinessInput {
  name: string;
  reportingCurrency: string;
  partners?: Array<{ partnerId: string; profitSharePercent: number }>;
}

export interface LedgerMapping {
  id: string;
  businessId: string;
  ledgerName: string;
  accountGroupCode: string;
  /** Set only on a partner's capital ledger. */
  partnerId?: string;
}

export interface MappingInput {
  ledgerName: string;
  accountGroupCode: string;
  partnerId?: string;
}

export interface ImportPreview {
  rows: Array<{ ledgerName: string; amount: number }>;
  /** Rows the parser declined, with the reason. Shown, never hidden. */
  skipped: Array<{ line: number; text: string; reason: string }>;
  /** Ledgers with nowhere to go. The import cannot run while any remain. */
  unmapped: string[];
}

export interface SnapshotMetrics {
  turnover: string;
  netProfit: string;
  netMarginPercent?: string;
  capitalEmployed: string;
  capitalMovement: string;
  cumulativeCapitalInjected: string;
  roiCashOnCashPercent?: string;
  rocePercent?: string;
}

export interface Snapshot {
  id: string;
  businessId: string;
  periodYear: number;
  periodMonth: number;
  revision: number;
  status: 'DRAFT' | 'LOCKED';
  reportingCurrency: string;
  rowCount: number;
  lockedAt?: string;
  metrics?: SnapshotMetrics;
}

/** Where a month's figures came from: a locked statement, or a result keyed by hand. */
export type PeriodFigureSource = 'STATEMENT' | 'KEYED';

export interface BusinessPerformance {
  businessId: string;
  businessName: string;
  reportingCurrency: string;
  figureSource: PeriodFigureSource;
  /** Absent for a keyed month, which has no snapshot. */
  revision?: number;
  /** Absent for a keyed month: the business reports a profit and no sales figure. */
  turnover?: string;
  netProfit: string;
  netMarginPercent?: string;
  capitalEmployed: string;
  cumulativeCapitalInjected: string;
  roiPercent?: string;
  rocePercent?: string;
  /** Undefined where the ratio had no denominator — not the same as failing. */
  meetsRoiTarget?: boolean;
  meetsMarginTarget?: boolean;
  score?: string;
  rank?: number;
}

export interface PortfolioView {
  periodYear: number;
  periodMonth: number;
  portfolioCurrency: string;
  targets: { roiPercentPerMonth: number; netMarginPercentPerMonth: number };
  weights?: { roi: number; netMargin: number; netProfit: number };
  businesses: BusinessPerformance[];
  /** Still trading but yet to report. Named so a short portfolio never reads as a complete one. */
  businessesWithoutLockedSnapshot: string[];
  totals: {
    businessCount: number;
    turnover: string;
    netProfit: string;
    cumulativeCapitalInjected: string;
    netMarginPercent?: string;
    roiPercent?: string;
  };
}

export interface PartnerStatement {
  partnerId: string;
  partnerName: string;
  periodYear: number;
  periodMonth: number;
  currency: string;
  businesses: Array<{
    businessId: string;
    businessName: string;
    figureSource: PeriodFigureSource;
    profitSharePercent: string;
    businessNetProfit: string;
    yourProfitShare: string;
    yourCapital: string;
    yourReturnPercent?: string;
  }>;
  totals: { profitShare: string; capital: string; returnPercent?: string };
}

export interface ForecastResult {
  metric: string;
  basedOnMonths: number;
  points: Array<{
    periodYear: number;
    periodMonth: number;
    value: string;
    low: string;
    high: string;
  }>;
  /** Present when no forecast was made. Shown as written — it explains itself. */
  refusedBecause?: string;
}

/**
 * One locked month of a business, converted into the portfolio's currency at that month's own
 * average rate — so months, and businesses, can be added together.
 */
export interface TrajectoryPoint {
  periodYear: number;
  periodMonth: number;
  figureSource: PeriodFigureSource;
  /** Absent for a keyed month. */
  turnover?: string;
  netProfit: string;
  netMarginPercent?: string;
  roiPercent?: string;
}
