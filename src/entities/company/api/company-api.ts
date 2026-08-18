import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { Company, CreateCompanyInput, UpdateCompanyInput } from '../model/types';

export async function listCompanies(): Promise<Company[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<Company[]>>(endpoints.companies.list());
  return data.data;
}

export async function getCompany(companyId: string): Promise<Company> {
  const { data } = await apiClient.get<ApiSuccessResponse<Company>>(
    endpoints.companies.byId(companyId),
  );
  return data.data;
}

export async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const { data } = await apiClient.post<ApiSuccessResponse<Company>>(
    endpoints.companies.create(),
    input,
  );
  return data.data;
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput,
): Promise<Company> {
  const { data } = await apiClient.patch<ApiSuccessResponse<Company>>(
    endpoints.companies.byId(companyId),
    input,
  );
  return data.data;
}
