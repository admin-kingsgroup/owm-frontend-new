export type CompanyStatus = 'ACTIVE' | 'INACTIVE';

/** Tally's F11 company features, all off until switched on. */
export interface CompanyFeatures {
  billWiseDetails: boolean;
  multiCurrency: boolean;
  costCentres: boolean;
  inventory: boolean;
  gst: boolean;
}

export interface Company {
  id: string;
  name: string;
  code: string;
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
