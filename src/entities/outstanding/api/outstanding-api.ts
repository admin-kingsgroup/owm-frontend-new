import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { OutstandingsReport } from '../model/types';

async function fetchOutstandings(url: string, asOf?: string): Promise<OutstandingsReport> {
  const { data } = await apiClient.get<ApiSuccessResponse<OutstandingsReport>>(url, {
    params: { asOf },
  });
  return data.data;
}

export const getReceivables = (companyId: string, asOf?: string) =>
  fetchOutstandings(endpoints.outstandings.receivables(companyId), asOf);

export const getPayables = (companyId: string, asOf?: string) =>
  fetchOutstandings(endpoints.outstandings.payables(companyId), asOf);
