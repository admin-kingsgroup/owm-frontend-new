import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Ledger,
  CreateLedgerInput,
  UpdateLedgerInput,
  OpeningBalanceSummary,
} from '../model/types';

export async function listLedgers(companyId: string): Promise<Ledger[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<Ledger[]>>(
    endpoints.ledgers.list(companyId),
  );
  return data.data;
}

export async function createLedger(companyId: string, input: CreateLedgerInput): Promise<Ledger> {
  const { data } = await apiClient.post<ApiSuccessResponse<Ledger>>(
    endpoints.ledgers.create(companyId),
    input,
  );
  return data.data;
}

export async function updateLedger(
  companyId: string,
  id: string,
  input: UpdateLedgerInput,
): Promise<Ledger> {
  const { data } = await apiClient.patch<ApiSuccessResponse<Ledger>>(
    endpoints.ledgers.byId(companyId, id),
    input,
  );
  return data.data;
}

export async function deleteLedger(companyId: string, id: string): Promise<void> {
  await apiClient.delete(endpoints.ledgers.byId(companyId, id));
}

export async function getOpeningBalanceSummary(
  companyId: string,
): Promise<OpeningBalanceSummary> {
  const { data } = await apiClient.get<ApiSuccessResponse<OpeningBalanceSummary>>(
    endpoints.ledgers.openingBalanceSummary(companyId),
  );
  return data.data;
}
