export type {
  OcrComparison,
  OcrDocumentData,
  OcrDocumentType,
  OcrExtractOptions,
  OcrLineItem,
  OcrMimeType,
  OcrProviderId,
  OcrProviderInfo,
  OcrProviders,
  OcrResult,
  OcrStatementReading,
  OcrStatementRow,
} from './model/types';
export * from './api/ocr-api';
export {
  OCR_ACCEPT,
  checkOcrFile,
  formatFileSize,
  ocrFileType,
  ocrTypeName,
} from './lib/check-file';
export { fitImageForOcr } from './lib/fit-image';
