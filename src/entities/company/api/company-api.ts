import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Company,
  CreateCompanyInput,
  PendingMasters,
  SeedPreview,
  SeedResult,
  UpdateCompanyInput,
} from '../model/types';

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

/**
 * What creating a company of this type would seed. Read from the server rather than listed here,
 * because a copy in the UI drifts from the templates the first time either changes — and the one
 * moment this list matters is the moment the choice becomes irreversible.
 */
export async function getSeedPreview(type: string): Promise<SeedPreview> {
  const { data } = await apiClient.get<ApiSuccessResponse<SeedPreview>>(
    endpoints.companies.seedPreview(type),
  );
  return data.data;
}

/**
 * What syncing this company would insert, without inserting it.
 *
 * Read before the control is offered, so a Sync whose only possible answer is "nothing to add" is
 * never put in front of anyone. Counted by the server from the same filters the sync itself
 * applies, so the two cannot disagree.
 */
export async function getPendingDefaultMasters(companyId: string): Promise<PendingMasters> {
  const { data } = await apiClient.get<ApiSuccessResponse<PendingMasters>>(
    endpoints.companies.pendingDefaultMasters(companyId),
  );
  return data.data;
}

/**
 * Gives a company the default groups, ledgers and voucher types added to the product since it was
 * created — Income and Expense for a personal book, the forex ledgers, and whatever comes next.
 *
 * Insert-only and idempotent on the server: it never updates and never deletes, so a group that
 * was renamed or switched off here survives it, and running it twice adds nothing the second time.
 * A company already on the current set is answered with zeroes rather than an error.
 */
export async function syncDefaultMasters(companyId: string): Promise<SeedResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<SeedResult>>(
    endpoints.companies.syncDefaultMasters(companyId),
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
