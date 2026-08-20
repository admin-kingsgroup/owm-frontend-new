import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { NumberSeries } from '../model/types';

export async function listNumberSeries(companyId: string): Promise<NumberSeries[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<NumberSeries[]>>(
    endpoints.numberSeries.list(companyId),
  );
  return data.data;
}
