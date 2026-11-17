import { describe, it, expect } from 'vitest';

import type { OcrProviderInfo } from '../model/types';

import { checkOcrFile, formatFileSize, ocrFileType } from './check-file';

const MB = 1024 * 1024;

function file(name: string, type: string, size: number): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

const grok: OcrProviderInfo = {
  id: 'grok',
  label: 'Grok (xAI)',
  configured: true,
  accepted_types: ['image/jpeg', 'image/png'],
  max_file_size_bytes: 5 * MB,
  reports_confidence: false,
  model: 'grok-4.7',
  notes: [],
};

const ocrSpace: OcrProviderInfo = {
  ...grok,
  id: 'ocr_space',
  label: 'OCR.space',
  accepted_types: ['image/jpeg', 'image/png', 'application/pdf'],
  max_file_size_bytes: 1 * MB,
};

/**
 * The browser's check runs before anything is uploaded, so its job is to refuse what the server
 * would refuse anyway — with the same reasons — and never to refuse what the server would read.
 */
describe('checkOcrFile', () => {
  it('takes the type from the extension when the browser gives none', () => {
    expect(ocrFileType(file('scan.PDF', '', 10))).toBe('application/pdf');
    expect(ocrFileType(file('photo.jpg', 'image/jpg', 10))).toBe('image/jpeg');
    expect(ocrFileType(file('notes.txt', 'text/plain', 10))).toBeNull();
  });

  it('accepts a file every limit allows', () => {
    expect(checkOcrFile(file('invoice.png', 'image/png', 200_000), 5 * MB, ocrSpace)).toBeNull();
  });

  it('refuses a format no provider reads', () => {
    expect(checkOcrFile(file('animation.gif', 'image/gif', 10), 5 * MB)).toBe(
      '“animation.gif” is not a JPG, PNG or PDF.',
    );
  });

  it('refuses an empty file', () => {
    expect(checkOcrFile(file('blank.png', 'image/png', 0), 5 * MB)).toMatch(/is empty/);
  });

  it("refuses a file over the server's limit, naming both sizes", () => {
    expect(checkOcrFile(file('big.png', 'image/png', 6 * MB), 5 * MB)).toBe(
      '“big.png” is 6 MB; the server accepts up to 5 MB.',
    );
  });

  it("applies the chosen provider's own types and size", () => {
    expect(checkOcrFile(file('report.pdf', 'application/pdf', 1000), 5 * MB, grok)).toBe(
      'Grok (xAI) reads JPG and PNG files only. Choose another provider for a PDF.',
    );
    expect(checkOcrFile(file('photo.jpg', 'image/jpeg', 2 * MB), 5 * MB, ocrSpace)).toMatch(
      /OCR.space accepts files up to 1 MB and this one is 2 MB/,
    );
  });

  it('leaves per-provider limits to the server in a comparison', () => {
    expect(checkOcrFile(file('report.pdf', 'application/pdf', 2 * MB), 5 * MB)).toBeNull();
  });

  it('formats sizes the way a person reads them', () => {
    expect(formatFileSize(512)).toBe('1 KB');
    expect(formatFileSize(850 * 1024)).toBe('850 KB');
    expect(formatFileSize(4.73 * MB)).toBe('4.7 MB');
  });
});
