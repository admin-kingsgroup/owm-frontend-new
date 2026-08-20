import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  AccountGroup,
  CreateAccountGroupInput,
  UpdateAccountGroupInput,
} from '../model/types';

export async function listAccountGroups(companyId: string): Promise<AccountGroup[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<AccountGroup[]>>(
    endpoints.accountGroups.list(companyId),
  );
  return data.data;
}

export async function createAccountGroup(
  companyId: string,
  input: CreateAccountGroupInput,
): Promise<AccountGroup> {
  const { data } = await apiClient.post<ApiSuccessResponse<AccountGroup>>(
    endpoints.accountGroups.create(companyId),
    input,
  );
  return data.data;
}

export async function updateAccountGroup(
  companyId: string,
  id: string,
  input: UpdateAccountGroupInput,
): Promise<AccountGroup> {
  const { data } = await apiClient.patch<ApiSuccessResponse<AccountGroup>>(
    endpoints.accountGroups.byId(companyId, id),
    input,
  );
  return data.data;
}

export async function deleteAccountGroup(companyId: string, id: string): Promise<void> {
  await apiClient.delete(endpoints.accountGroups.byId(companyId, id));
}
