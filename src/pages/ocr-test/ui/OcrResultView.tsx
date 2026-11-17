import { useState } from 'react';

import { formatFileSize } from '@/entities/ocr';
import type { OcrDocumentData, OcrResult } from '@/entities/ocr';
import { Badge, Panel, Table, Tabs } from '@/shared/ui';

import { displayValue, documentTypeLabel, fieldLabel, isMoneyField, isNumeric } from './format';
import styles from './OcrTestPage.module.css';

type View = 'fields' | 'text' | 'json';

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'fields', label: 'Structured' },
  { id: 'text', label: 'Text' },
  { id: 'json', label: 'JSON' },
];

/** One line saying what produced the result and what it cost — the facts a comparison turns on. */
function describe(result: OcrResult): string[] {
  const { meta } = result;
  const parts = [
    meta.model,
    meta.page_count !== null ? `${meta.page_count} page${meta.page_count === 1 ? '' : 's'}` : null,
    formatFileSize(meta.file_size_bytes),
    meta.dimensions ? `${meta.dimensions.width}×${meta.dimensions.height} px` : null,
    `${(meta.duration_ms / 1000).toFixed(1)} s`,
    meta.structured_by === 'provider_model'
      ? 'fields by the provider’s model'
      : meta.structured_by === 'pattern_rules'
        ? 'fields by pattern rules'
        : null,
    meta.usage?.input_tokens != null
      ? `${meta.usage.input_tokens.toLocaleString()} in / ${(meta.usage.output_tokens ?? 0).toLocaleString()} out tokens`
      : null,
    result.confidence !== null
      ? `confidence ${Math.round(result.confidence * 100)}%`
      : 'confidence not reported',
  ];
  return parts.filter((part): part is string => Boolean(part));
}

function StructuredView({ data }: { data: OcrDocumentData | null }) {
  if (!data) {
    return <p className={styles.muted}>Structured output was not requested for this run.</p>;
  }

  const currency = data.fields.currency;
  const fields = Object.entries(data.fields);

  return (
    <div className={styles.structured}>
      <p className={styles.docType}>
        Document type: <Badge variant="info">{documentTypeLabel(data.document_type)}</Badge>
      </p>

      <Table surface="plain" zebra={false} tableClassName={styles.grid}>
        <thead>
          <tr>
            <th>Sr No</th>
            <th>Field</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(([field, value], index) => {
            const shown = displayValue(field, value, currency);
            return (
              <tr key={field}>
                <td data-num>{index + 1}</td>
                <td>{fieldLabel(field)}</td>
                {value === null ? (
                  <td data-muted>not found</td>
                ) : isMoneyField(field) && isNumeric(value) ? (
                  <td data-num>{shown}</td>
                ) : (
                  <td data-wrap>{shown}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>

      {data.items && (
        <>
          <p className={styles.subheading}>Line items</p>
          {data.items.length === 0 ? (
            <p className={styles.muted}>No line items were identified.</p>
          ) : (
            <Table surface="plain" tableClassName={styles.grid}>
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td data-num>{index + 1}</td>
                    <td data-wrap>{item.description ?? '—'}</td>
                    {isNumeric(item.quantity) ? (
                      <td data-num>{item.quantity}</td>
                    ) : (
                      <td>{item.quantity ?? '—'}</td>
                    )}
                    <td data-num>{displayValue('unit_price', item.unit_price, currency)}</td>
                    <td data-num>{displayValue('amount', item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One provider's reading of the document: what it found, as fields, as text, and as the raw JSON
 * the API returned — the last so a tester can see exactly what an integration would receive.
 */
export function OcrResultView({ result, label }: { result: OcrResult; label: string }) {
  const [view, setView] = useState<View>(result.document_data ? 'fields' : 'text');

  return (
    <Panel
      className={styles.result}
      title={
        <span className={styles.resultTitle}>
          {label}
          <Badge variant={result.success ? 'success' : 'danger'}>
            {result.success ? 'Read' : 'Failed'}
          </Badge>
        </span>
      }
    >
      {!result.success ? (
        <p className={styles.error} role="alert">
          {result.error}
        </p>
      ) : (
        <>
          <p className={styles.meta}>{describe(result).join(' · ')}</p>

          {result.warnings.length > 0 && (
            <ul className={styles.warnings} aria-label="Warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <Tabs items={VIEWS} value={view} onChange={setView} label={`${label} result`} />

          {view === 'fields' && <StructuredView data={result.document_data} />}
          {view === 'text' && (
            <pre className={styles.code}>{result.extracted_text || 'No text was found.'}</pre>
          )}
          {view === 'json' && <pre className={styles.code}>{JSON.stringify(result, null, 2)}</pre>}
        </>
      )}
    </Panel>
  );
}
