export type FinancialYearStatus = 'OPEN' | 'CLOSED';

export interface FinancialYear {
  id: string;
  companyId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: FinancialYearStatus;
}

export interface CreateFinancialYearInput {
  label?: string;
  startDate: string;
  endDate: string;
}
