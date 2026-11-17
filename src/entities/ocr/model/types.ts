/**
 * The OCR test API's shapes, as the server sends them.
 *
 * snake_case, unlike the rest of the API: it is the response format the OCR integration was
 * specified with, and keeping the server's names means the JSON tab and these types never differ.
 */

export type OcrProviderId = 'ocr_space' | 'grok';

export type OcrMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

export type OcrDocumentType =
  | 'invoice'
  | 'receipt'
  | 'purchase_order'
  | 'delivery_note'
  | 'identity_document'
  | 'letter'
  | 'form'
  | 'other';

export interface OcrLineItem {
  description: string | null;
  quantity: string | null;
  unit_price: string | null;
  amount: string | null;
}

export interface OcrDocumentData {
  document_type: OcrDocumentType;
  fields: Record<string, string | null>;
  /** Only on invoices, receipts, purchase orders and delivery notes. */
  items?: OcrLineItem[];
}

export interface OcrResult {
  success: boolean;
  provider: OcrProviderId;
  extracted_text: string | null;
  document_data: OcrDocumentData | null;
  confidence: number | null;
  pages: Array<{ page_number: number; text: string }>;
  warnings: string[];
  meta: {
    mime_type: OcrMimeType;
    file_size_bytes: number;
    dimensions: { width: number; height: number } | null;
    page_count: number | null;
    duration_ms: number;
    model: string | null;
    structured_by: 'provider_model' | 'pattern_rules' | null;
    usage: { input_tokens: number | null; output_tokens: number | null } | null;
  };
  error: string | null;
}

export interface OcrComparison {
  results: OcrResult[];
  summary: {
    compared: OcrProviderId[];
    text_similarity: number | null;
    document_types: Partial<Record<OcrProviderId, OcrDocumentType | null>>;
    field_differences: Array<{
      field: string;
      values: Partial<Record<OcrProviderId, string | null>>;
    }>;
  };
}

export interface OcrProviderInfo {
  id: OcrProviderId;
  label: string;
  configured: boolean;
  accepted_types: OcrMimeType[];
  max_file_size_bytes: number;
  reports_confidence: boolean;
  model: string | null;
  notes: string[];
}

export interface OcrProviders {
  enabled: boolean;
  default_provider: OcrProviderId | null;
  max_file_size_bytes: number;
  providers: OcrProviderInfo[];
}

export interface OcrExtractOptions {
  provider?: OcrProviderId;
  structured: boolean;
}

/** One transaction line of a bank statement photo, as the server read it. */
export interface OcrStatementRow {
  /** As printed. */
  date: string | null;
  /** YYYY-MM-DD, or null when the printed date could not be read as one. */
  date_iso: string | null;
  description: string | null;
  reference: string | null;
  /** Always positive; which way it moved is `direction`. */
  amount: string | null;
  /** Null when the statement did not make it readable — never guessed. */
  direction: 'withdrawal' | 'deposit' | null;
  /** Running balance after this line; negative when overdrawn. */
  balance: string | null;
}

/** A bank statement photo read into rows. Nothing is stored by reading it. */
export interface OcrStatementReading {
  provider: OcrProviderId;
  extracted_text: string;
  statement: {
    bank_name: string | null;
    account_number: string | null;
    period_from: string | null;
    period_to: string | null;
    opening_balance: string | null;
    closing_balance: string | null;
    rows: OcrStatementRow[];
  };
  warnings: string[];
  meta: OcrResult['meta'];
}
