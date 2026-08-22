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

/**
 * Ticks one cash or bank line off against a statement, or takes the mark off with `null`.
 *
 * On the voucher rather than on the report, because that is what it changes — the reconciliation
 * report is a reading of these marks, not their owner.
 */
export async function reconcileEntry(
  companyId: string,
  voucherId: string,
  entryId: string,
  reconciledOn: string | null,
): Promise<void> {
  await apiClient.post(endpoints.reconcileEntry(companyId, voucherId, entryId), { reconciledOn });
}
