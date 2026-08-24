export type CompanyStatus = 'ACTIVE' | 'INACTIVE';

/**
 * What a company is for, which decides what it is seeded with. Fixed at creation — seeding runs
 * once, so a company cannot change its mind later without holding another kind's masters.
 */
export type CompanyType = 'TRADING' | 'PERSONAL' | 'ANALYTICS';

/** Exactly what a company of a given type will be seeded with, read from the server's templates. */
export interface SeedPreview {
  type: CompanyType;
  accountGroups: Array<{ code: string; name: string; parentCode: string | null }>;
  ledgers: Array<{ code: string; name: string; groupCode: string }>;
  voucherTypes: Array<{ code: string; name: string; prefix: string }>;
}

/**
 * What syncing the default masters actually inserted.
 *
 * Every count is zero when the company is already on the current set — the server answers that
 * rather than refusing, so the screen can say "nothing to add" instead of reporting an error for
 * the ordinary case. `seedVersion` is the version the company is on afterwards.
 */
/**
 * What a sync would insert, asked before offering to run one.
 *
 * Being behind by the version and having something to receive are different questions: a row is
 * tagged with the kind of company it belongs to as well as the version it arrived in, so a trading
 * company created before a release of personal-only rows is behind and missing nothing.
 */
export interface PendingMasters {
  accountGroups: number;
  ledgers: number;
  voucherTypes: number;
  numberSeries: number;
}

export interface SeedResult {
  accountGroups: number;
  ledgers: number;
  voucherTypes: number;
  numberSeries: number;
  seedVersion: number;
}

/** Tally's F11 company features, all off until switched on. */
export interface CompanyFeatures {
  billWiseDetails: boolean;
  multiCurrency: boolean;
}

export interface Company {
  id: string;
  name: string;
  code: string;
  type: CompanyType;
  legalName?: string;
  financialYearStart: string;
  financialYearEnd: string;
  baseCurrency: string;
  country: string;
  /** State or province — what decides CGST+SGST versus IGST on an Indian invoice. */
  state?: string;
  timezone: string;
  status: CompanyStatus;
  /**
   * True once the company's default masters are seeded — it stopped being a hardcoded literal when
   * seeding returned, so it now actually reports whether the company is usable.
   */
  initialized: boolean;
  /** Version of the seeded master set this company holds; 0 means it predates seeding. */
  seedVersion: number;
  /**
   * The version the product is on now. A constant of the release, sent with the company because it
   * is only ever read against `seedVersion` — and because a copy of it here would be wrong from
   * the first release that bumps it.
   */
  currentSeedVersion: number;
  features: CompanyFeatures;
}

export interface CreateCompanyInput {
  name: string;
  code: string;
  /** Omitted defaults to TRADING on the server. */
  type?: CompanyType;
  legalName?: string;
  financialYearStart: string;
  financialYearEnd: string;
  baseCurrency: string;
  country: string;
  state?: string;
  timezone: string;
}

/**
 * No financial year fields: the pair on CreateCompanyInput seeds the company's first year, and
 * financial years are edited through their own endpoints from then on.
 */
export interface UpdateCompanyInput {
  name?: string;
  legalName?: string;
  features?: Partial<CompanyFeatures>;
  country?: string;
  state?: string;
  timezone?: string;
  status?: CompanyStatus;
}
