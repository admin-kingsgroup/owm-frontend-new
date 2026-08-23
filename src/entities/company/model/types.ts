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

/** Tally's F11 company features, all off until switched on. */
export interface CompanyFeatures {
  billWiseDetails: boolean;
  multiCurrency: boolean;
  gst: boolean;
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
