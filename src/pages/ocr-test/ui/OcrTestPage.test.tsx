// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { OcrComparison, OcrProviders, OcrResult } from '@/entities/ocr';

import { OcrTestPage } from './OcrTestPage';

let providers: OcrProviders;
const getProviders = vi.fn(async () => providers);
const extract = vi.fn(async (_file: File, _options: unknown): Promise<OcrResult> => invoiceResult);
const compare = vi.fn(
  async (_file: File, _structured: boolean): Promise<OcrComparison> => comparison,
);

vi.mock('@/entities/ocr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/ocr')>()),
  getOcrProviders: () => getProviders(),
  extractDocument: (file: File, options: unknown) => extract(file, options),
  compareOcrProviders: (file: File, structured: boolean) => compare(file, structured),
}));

const MB = 1024 * 1024;

const configured = (): OcrProviders => ({
  enabled: true,
  default_provider: 'ocr_space',
  max_file_size_bytes: 5 * MB,
  providers: [
    {
      id: 'ocr_space',
      label: 'OCR.space',
      configured: true,
      accepted_types: ['image/jpeg', 'image/png', 'application/pdf'],
      max_file_size_bytes: 1 * MB,
      reports_confidence: false,
      model: 'OCR engine 2',
      notes: ['Free tier: 25,000 requests/month.'],
    },
    {
      id: 'grok',
      label: 'Grok (xAI)',
      configured: false,
      accepted_types: ['image/jpeg', 'image/png'],
      max_file_size_bytes: 5 * MB,
      reports_confidence: false,
      model: 'grok-4.7',
      notes: [],
    },
  ],
});

const meta: OcrResult['meta'] = {
  mime_type: 'image/png',
  file_size_bytes: 200_000,
  dimensions: { width: 1240, height: 1754 },
  page_count: 1,
  duration_ms: 1800,
  model: 'OCR engine 2',
  structured_by: 'pattern_rules',
  usage: null,
};

const invoiceResult: OcrResult = {
  success: true,
  provider: 'ocr_space',
  extracted_text: 'TAX INVOICE\nInvoice No: INV-42\nGrand Total Rs. 1,25,000.00',
  document_data: {
    document_type: 'invoice',
    fields: {
      document_number: 'INV-42',
      seller_name: null,
      currency: 'INR',
      total_amount: '125000.00',
    },
    items: [],
  },
  confidence: null,
  pages: [{ page_number: 1, text: '…' }],
  warnings: ['Fields were read by pattern rules from the OCR text.'],
  meta,
  error: null,
};

const comparison: OcrComparison = {
  results: [
    invoiceResult,
    {
      ...invoiceResult,
      provider: 'grok',
      success: false,
      extracted_text: null,
      document_data: null,
      warnings: [],
      error: 'Grok (xAI) is not configured on this server. Set XAI_API_KEY to use it.',
    },
  ],
  summary: {
    compared: ['ocr_space'],
    text_similarity: null,
    document_types: { ocr_space: 'invoice' },
    field_differences: [],
  },
};

function pick(name: string, type: string, size = 200_000) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
  return file;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OcrTestPage />
    </MemoryRouter>,
  );
}

describe('OcrTestPage', () => {
  beforeEach(() => {
    providers = configured();
    // jsdom has no object URLs; the preview only needs a string.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('says the feature is off rather than offering an upload that would be refused', async () => {
    providers = { ...configured(), enabled: false };
    renderPage();

    expect(await screen.findByText('OCR testing is turned off on this server')).toBeTruthy();
    expect(screen.queryByLabelText('File')).toBeNull();
  });

  it('warns that documents leave the server before anything can be uploaded', async () => {
    renderPage();
    expect((await screen.findByRole('note')).textContent).toMatch(/sends the file to the provider/);
  });

  it('starts on the default provider and marks an unconfigured one', async () => {
    renderPage();

    const select = (await screen.findByLabelText('Provider')) as HTMLSelectElement;
    expect(select.value).toBe('ocr_space');
    const grok = within(select).getByRole('option', {
      name: 'Grok (xAI) (not configured)',
    }) as HTMLOptionElement;
    expect(grok.disabled).toBe(true);
  });

  it('refuses an unreadable file in the browser, without uploading it', async () => {
    renderPage();
    await screen.findByLabelText('File');

    pick('animation.gif', 'image/gif');

    expect(screen.getByRole('alert').textContent).toBe('“animation.gif” is not a JPG, PNG or PDF.');
    expect(
      (screen.getByRole('button', { name: /Read document/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(extract).not.toHaveBeenCalled();
  });

  it("applies the provider's own size limit before uploading", async () => {
    renderPage();
    await screen.findByLabelText('File');

    pick('photo.jpg', 'image/jpeg', 2 * MB);

    expect(screen.getByRole('alert').textContent).toMatch(/OCR.space accepts files up to 1 MB/);
  });

  it('reads a document and shows its fields, the preview and the warnings', async () => {
    renderPage();
    await screen.findByLabelText('File');

    const file = pick('invoice.png', 'image/png');
    expect(screen.getByAltText('Uploaded document preview').getAttribute('src')).toBe(
      'blob:preview',
    );

    fireEvent.click(screen.getByRole('button', { name: /Read document/ }));

    await screen.findByText('Invoice');
    expect(extract).toHaveBeenCalledWith(file, { provider: 'ocr_space', structured: true });

    // Rupee amounts grouped the Indian way; a field that was not found says so.
    expect(screen.getByText('₹1,25,000.00')).toBeTruthy();
    expect(screen.getByText('not found')).toBeTruthy();
    expect(screen.getByText('Fields were read by pattern rules from the OCR text.')).toBeTruthy();
    expect(screen.getAllByRole('columnheader')[0].textContent).toBe('Sr No');

    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
    expect(screen.getByText(/Grand Total Rs\. 1,25,000\.00/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    expect(screen.getByText(/"extracted_text": "TAX INVOICE/)).toBeTruthy();
  });

  it("shows a comparison with each provider's outcome, failures included", async () => {
    renderPage();
    const select = await screen.findByLabelText('Provider');

    pick('invoice.png', 'image/png');
    fireEvent.change(select, { target: { value: 'compare' } });
    fireEvent.click(screen.getByRole('button', { name: /Compare providers/ }));

    await screen.findByText('Comparison');
    expect(compare).toHaveBeenCalledWith(expect.any(File), true);
    expect(screen.getByText('Needs two providers that both returned a result')).toBeTruthy();
    expect(screen.getByText(/Set XAI_API_KEY to use it/)).toBeTruthy();
  });

  it("shows the server's reason when a read fails", async () => {
    extract.mockRejectedValueOnce(
      new Error('OCR.space could not read this document: Unable to parse image'),
    );
    renderPage();
    await screen.findByLabelText('File');

    pick('invoice.png', 'image/png');
    fireEvent.click(screen.getByRole('button', { name: /Read document/ }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'OCR.space could not read this document: Unable to parse image',
      ),
    );
  });
});
