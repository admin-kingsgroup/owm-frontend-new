import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import { ocrFileType } from '../lib/check-file';
import type { OcrComparison, OcrExtractOptions, OcrProviders, OcrResult } from '../model/types';

/**
 * Long enough for the server's own provider timeout (45 s by default) plus the upload. The server
 * answers a slow provider itself, with a message; this is only so a dead connection does not hang
 * the screen for ever.
 */
const OCR_REQUEST_TIMEOUT_MS = 90_000;

/**
 * The file goes up as the request body itself, with its own Content-Type — the server reads raw
 * bytes, so there is no form to build. The type comes from the file, or its extension when the
 * browser did not supply one.
 */
function fileRequest(file: File) {
  return {
    headers: { 'Content-Type': ocrFileType(file) ?? 'application/octet-stream' },
    timeout: OCR_REQUEST_TIMEOUT_MS,
  };
}

export async function getOcrProviders(): Promise<OcrProviders> {
  const { data } = await apiClient.get<ApiSuccessResponse<OcrProviders>>(endpoints.ocr.providers());
  return data.data;
}

export async function extractDocument(file: File, options: OcrExtractOptions): Promise<OcrResult> {
  const { data } = await apiClient.post<ApiSuccessResponse<OcrResult>>(
    endpoints.ocr.extract(),
    file,
    {
      ...fileRequest(file),
      params: { provider: options.provider, structured: String(options.structured) },
    },
  );
  return data.data;
}

export async function compareOcrProviders(file: File, structured: boolean): Promise<OcrComparison> {
  const { data } = await apiClient.post<ApiSuccessResponse<OcrComparison>>(
    endpoints.ocr.compare(),
    file,
    { ...fileRequest(file), params: { structured: String(structured) } },
  );
  return data.data;
}
