import { ocrFileType } from '@/entities/ocr';
import type { OcrProviderId } from '@/entities/ocr';
import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type { BankStatementMatch } from '../model/types';

/** The server answers a slow provider itself within 45 s; this only stops a dead connection. */
const STATEMENT_REQUEST_TIMEOUT_MS = 90_000;

/**
 * Sends the statement file — its own bytes, with its own Content-Type — and gets back each line
 * with the open book line it appears to be. Nothing is reconciled by this call.
 */
export async function matchBankStatement(
  companyId: string,
  ledgerId: string,
  file: File,
  provider?: OcrProviderId,
): Promise<BankStatementMatch> {
  const { data } = await apiClient.post<ApiSuccessResponse<BankStatementMatch>>(
    endpoints.bankStatements.match(companyId, ledgerId),
    file,
    {
      headers: { 'Content-Type': ocrFileType(file) ?? 'application/octet-stream' },
      params: { provider },
      timeout: STATEMENT_REQUEST_TIMEOUT_MS,
    },
  );
  return data.data;
}
