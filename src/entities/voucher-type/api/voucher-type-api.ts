import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { VoucherType, CreateVoucherTypeInput, UpdateVoucherTypeInput } from '../model/types';

export async function listVoucherTypes(companyId: string): Promise<VoucherType[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<VoucherType[]>>(
    endpoints.voucherTypes.list(companyId),
  );
  return data.data;
}

export async function createVoucherType(
  companyId: string,
  input: CreateVoucherTypeInput,
): Promise<VoucherType> {
  const { data } = await apiClient.post<ApiSuccessResponse<VoucherType>>(
    endpoints.voucherTypes.create(companyId),
    input,
  );
  return data.data;
}

export async function updateVoucherType(
  companyId: string,
  id: string,
  input: UpdateVoucherTypeInput,
): Promise<VoucherType> {
  const { data } = await apiClient.patch<ApiSuccessResponse<VoucherType>>(
    endpoints.voucherTypes.byId(companyId, id),
    input,
  );
  return data.data;
}
