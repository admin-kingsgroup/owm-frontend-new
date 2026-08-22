import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Ledger,
  CreateLedgerInput,
  UpdateLedgerInput,
  OpeningBalanceSummary,
  OpeningBills,
  OpeningBillInput,
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

export async function getOpeningBalanceSummary(companyId: string): Promise<OpeningBalanceSummary> {
  const { data } = await apiClient.get<ApiSuccessResponse<OpeningBalanceSummary>>(
    endpoints.ledgers.openingBalanceSummary(companyId),
  );
  return data.data;
}

/** A party's carried-forward invoices, as they stand. */
export async function getOpeningBills(companyId: string, ledgerId: string): Promise<OpeningBills> {
  const { data } = await apiClient.get<ApiSuccessResponse<OpeningBills>>(
    endpoints.openingBills(companyId, ledgerId),
  );
  return data.data;
}

/**
 * States what a party's opening bills are, rather than adding one more.
 *
 * A PUT because this is a statement of what was outstanding on day one, and that is corrected as
 * a whole. An empty list clears them.
 */
export async function setOpeningBills(
  companyId: string,
  ledgerId: string,
  bills: OpeningBillInput[],
): Promise<OpeningBills> {
  const { data } = await apiClient.put<ApiSuccessResponse<OpeningBills>>(
    endpoints.openingBills(companyId, ledgerId),
    { bills },
  );
  return data.data;
}
