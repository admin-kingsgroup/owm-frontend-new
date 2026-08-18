export type CompanyStatus = 'ACTIVE' | 'INACTIVE';

export interface Company {
  id: string;
  name: string;
  code: string;
  legalName?: string;
  financialYearStart: string;
  financialYearEnd: string;
  baseCurrency: string;
  country: string;
  timezone: string;
  status: CompanyStatus;
  initialized: true;
}

export interface CreateCompanyInput {
  name: string;
  code: string;
  legalName?: string;
  financialYearStart: string;
  financialYearEnd: string;
  baseCurrency: string;
  country: string;
  timezone: string;
}

export interface UpdateCompanyInput {
  name?: string;
  legalName?: string;
  financialYearStart?: string;
  financialYearEnd?: string;
  country?: string;
  timezone?: string;
  status?: CompanyStatus;
}
