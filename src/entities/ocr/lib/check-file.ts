import type { OcrMimeType, OcrProviderInfo } from '../model/types';

/** For the file picker: the extensions and the types, so every platform's dialog filters. */
export const OCR_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';

const BY_EXTENSION: Record<string, OcrMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

const TYPE_NAMES: Record<OcrMimeType, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
};

/**
 * The file's type as the server will be told it: the browser's own, or failing that the extension.
 * Some systems hand over a PDF or a scan with an empty `type`. The server checks the actual bytes
 * either way — this only decides what to declare and what to refuse before uploading.
 */
export function ocrFileType(file: File): OcrMimeType | null {
  const declared = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (declared in TYPE_NAMES) return declared as OcrMimeType;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

/** A size as a person reads it: "850 KB", "1 MB", "4.7 MB". */
export function formatFileSize(bytes: number): string {
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.max(1, Math.round(kilobytes))} KB`;
  return `${Math.round((kilobytes / 1024) * 10) / 10} MB`;
}

export function ocrTypeName(type: OcrMimeType): string {
  return TYPE_NAMES[type];
}

/**
 * Why this file cannot be sent, or null when it can.
 *
 * The same rules the server applies, checked first so an obviously wrong file is refused in the
 * browser rather than after uploading it — the server still checks everything again. With a
 * provider given, its own type list and size ceiling apply as well; without one (a comparison),
 * the server reports each provider's verdict alongside the others' results.
 */
export function checkOcrFile(
  file: File,
  serverLimitBytes: number,
  provider?: OcrProviderInfo,
): string | null {
  const type = ocrFileType(file);

  if (!type) return `“${file.name}” is not a JPG, PNG or PDF.`;
  if (file.size === 0) return `“${file.name}” is empty.`;

  if (file.size > serverLimitBytes) {
    return `“${file.name}” is ${formatFileSize(file.size)}; the server accepts up to ${formatFileSize(serverLimitBytes)}.`;
  }

  if (provider && !provider.accepted_types.includes(type)) {
    const accepted = provider.accepted_types.map(ocrTypeName).join(' and ');
    return `${provider.label} reads ${accepted} files only. Choose another provider for a ${ocrTypeName(type)}.`;
  }

  if (provider && file.size > provider.max_file_size_bytes) {
    return `${provider.label} accepts files up to ${formatFileSize(provider.max_file_size_bytes)} and this one is ${formatFileSize(file.size)}. Compress it, or choose another provider.`;
  }

  return null;
}
