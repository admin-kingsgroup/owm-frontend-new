import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  BatchResult,
  StatementWorkspace,
  UploadStatementInput,
  UploadStatementResult,
} from '../model/types';

/** Everything the statement panel shows for one bank account. */
export async function getStatementWorkspace(
  companyId: string,
  ledgerId: string,
): Promise<StatementWorkspace> {
  const { data } = await apiClient.get<ApiSuccessResponse<StatementWorkspace>>(
    endpoints.bankStatements.workspace(companyId, ledgerId),
  );
  // A server from before the books' side was added sends no `bookLines`; show the bank side alone
  // rather than failing the whole screen.
  return { ...data.data, bookLines: data.data.bookLines ?? [] };
}

/** Sends the checked lines of one file. The server stores the new ones and matches them. */
export async function uploadStatement(
  companyId: string,
  ledgerId: string,
  input: UploadStatementInput,
): Promise<UploadStatementResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<UploadStatementResult>>(
    endpoints.bankStatements.workspace(companyId, ledgerId),
    input,
  );
  return data.data;
}

export async function rerunStatementMatch(companyId: string, ledgerId: string): Promise<number> {
  const { data } = await apiClient.post<ApiSuccessResponse<{ suggested: number }>>(
    endpoints.bankStatements.match(companyId, ledgerId),
  );
  return data.data.suggested;
}

/** Accepts proposed matches. Without ids, every proposal for the account. */
export async function confirmStatementMatches(
  companyId: string,
  ledgerId: string,
  lineIds?: string[],
): Promise<BatchResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<BatchResult>>(
    endpoints.bankStatements.confirm(companyId, ledgerId),
    { lineIds },
  );
  return data.data;
}

export async function matchStatementLine(
  companyId: string,
  ledgerId: string,
  lineId: string,
  entryId: string,
): Promise<void> {
  await apiClient.post(endpoints.bankStatements.line(companyId, ledgerId, lineId, 'match'), {
    entryId,
  });
}

export async function undoStatementLine(
  companyId: string,
  ledgerId: string,
  lineId: string,
): Promise<void> {
  await apiClient.post(endpoints.bankStatements.line(companyId, ledgerId, lineId, 'undo'));
}

export async function ignoreStatementLine(
  companyId: string,
  ledgerId: string,
  lineId: string,
): Promise<void> {
  await apiClient.post(endpoints.bankStatements.line(companyId, ledgerId, lineId, 'ignore'));
}

/** Raises a DRAFT voucher for each bank line missing from the books. */
export async function createStatementVouchers(
  companyId: string,
  ledgerId: string,
  items: Array<{ lineId: string; contraLedgerId: string; narration?: string }>,
): Promise<BatchResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<BatchResult>>(
    endpoints.bankStatements.vouchers(companyId, ledgerId),
    { items },
  );
  return data.data;
}

/** Posts the drafts raised from the statement. Without ids, all of them. */
export async function postStatementVouchers(
  companyId: string,
  ledgerId: string,
  lineIds?: string[],
): Promise<BatchResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<BatchResult>>(
    endpoints.bankStatements.postVouchers(companyId, ledgerId),
    { lineIds },
  );
  return data.data;
}

export async function deleteStatement(
  companyId: string,
  ledgerId: string,
  statementId: string,
): Promise<void> {
  await apiClient.delete(endpoints.bankStatements.statement(companyId, ledgerId, statementId));
}
