export type RateType = 'STANDARD' | 'SELLING' | 'BUYING';

export interface Currency {
  id: string;
  companyId: string;
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  subunitName?: string;
  isActive: boolean;
}

export interface CreateCurrencyInput {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces?: number;
  subunitName?: string;
}

export interface ExchangeRate {
  id: string;
  currencyId: string;
  currencyCode: string;
  effectiveFrom: string;
  rateType: RateType;
  /** Units of base currency per one unit of the foreign currency. */
  rate: string;
}

export interface CreateExchangeRateInput {
  currencyCode: string;
  effectiveFrom: string;
  rateType?: RateType;
  rate: number;
}

export interface ForexLine {
  billId: string;
  ledgerCode: string;
  ledgerName: string;
  reference: string;
  currencyCode: string;
  fcOutstanding: string;
  bookedBase: string;
  revaluedBase?: string;
  gainLoss: string;
  kind: 'REALISED' | 'UNREALISED';
}

export interface ForexGainLossReport {
  asOf: string;
  lines: ForexLine[];
  /** Bills left out because no closing rate has been entered for their currency. */
  skippedForMissingRate: string[];
  totals: { realised: string; unrealised: string; unadjusted: string };
}
