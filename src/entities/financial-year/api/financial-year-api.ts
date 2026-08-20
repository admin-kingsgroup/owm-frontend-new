import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { FinancialYear, CreateFinancialYearInput } from '../model/types';

export async function listFinancialYears(companyId: string): Promise<FinancialYear[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<FinancialYear[]>>(
    endpoints.financialYears.list(companyId),
  );
  return data.data;
}

export async function createFinancialYear(
  companyId: string,
  input: CreateFinancialYearInput,
): Promise<FinancialYear> {
  const { data } = await apiClient.post<ApiSuccessResponse<FinancialYear>>(
    endpoints.financialYears.create(companyId),
    input,
  );
  return data.data;
}

export async function closeFinancialYear(
  companyId: string,
  id: string,
): Promise<FinancialYear> {
  const { data } = await apiClient.post<ApiSuccessResponse<FinancialYear>>(
    endpoints.financialYears.close(companyId, id),
  );
  return data.data;
}

export async function reopenFinancialYear(
  companyId: string,
  id: string,
): Promise<FinancialYear> {
  const { data } = await apiClient.post<ApiSuccessResponse<FinancialYear>>(
    endpoints.financialYears.reopen(companyId, id),
  );
  return data.data;
}

export async function deleteFinancialYear(companyId: string, id: string): Promise<void> {
  await apiClient.delete(endpoints.financialYears.byId(companyId, id));
}
