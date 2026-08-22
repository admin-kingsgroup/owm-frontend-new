import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { ClientErrorList, ClientErrorListQuery } from '../model/types';

export async function listClientErrors(query: ClientErrorListQuery = {}): Promise<ClientErrorList> {
  const { data } = await apiClient.get<ApiSuccessResponse<ClientErrorList>>(
    endpoints.clientErrors.list(),
    { params: query },
  );
  return data.data;
}
