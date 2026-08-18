import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Voucher,
  CreateVoucherInput,
  VoucherListQuery,
  VoucherListResult,
} from '../model/types';

export async function listVouchers(
  companyId: string,
  query: VoucherListQuery = {},
): Promise<VoucherListResult> {
  const { data } = await apiClient.get<ApiSuccessResponse<VoucherListResult>>(
    endpoints.vouchers.list(companyId),
    { params: query },
  );
  return data.data;
}

export async function getVoucher(companyId: string, id: string): Promise<Voucher> {
  const { data } = await apiClient.get<ApiSuccessResponse<Voucher>>(
    endpoints.vouchers.byId(companyId, id),
  );
  return data.data;
}

export async function createVoucher(
  companyId: string,
  input: CreateVoucherInput,
): Promise<Voucher> {
  const { data } = await apiClient.post<ApiSuccessResponse<Voucher>>(
    endpoints.vouchers.create(companyId),
    input,
  );
  return data.data;
}

export async function postVoucher(companyId: string, id: string): Promise<Voucher> {
  const { data } = await apiClient.post<ApiSuccessResponse<Voucher>>(
    endpoints.vouchers.post(companyId, id),
  );
  return data.data;
}

export async function cancelVoucher(companyId: string, id: string): Promise<Voucher> {
  const { data } = await apiClient.post<ApiSuccessResponse<Voucher>>(
    endpoints.vouchers.cancel(companyId, id),
  );
  return data.data;
}
