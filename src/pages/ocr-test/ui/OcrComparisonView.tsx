import type { OcrComparison, OcrProviderId } from '@/entities/ocr';
import { Panel, Table } from '@/shared/ui';

import { displayValue, documentTypeLabel, fieldLabel, isMoneyField, isNumeric } from './format';
import { OcrResultView } from './OcrResultView';
import styles from './OcrTestPage.module.css';

/**
 * Every provider's reading of one document, with what they agree and disagree on first.
 *
 * The disagreements are the point of comparing: two readings that match need no attention, and the
 * fields that differ are where one of them is wrong.
 */
export function OcrComparisonView({
  comparison,
  labels,
}: {
  comparison: OcrComparison;
  labels: Record<OcrProviderId, string>;
}) {
  const { summary, results } = comparison;
  const compared = summary.compared;
  // A currency either provider found, so amounts in the table can carry their symbol.
  const currency = results
    .map((result) => result.document_data?.fields.currency)
    .find((value): value is string => Boolean(value));

  return (
    <div className={styles.results}>
      <Panel title="Comparison">
        <dl className={styles.summary}>
          <div>
            <dt>Text agreement</dt>
            <dd>
              {summary.text_similarity !== null
                ? `${Math.round(summary.text_similarity * 100)}% of words in common`
                : 'Needs two providers that both returned a result'}
            </dd>
          </div>
          <div>
            <dt>Document type</dt>
            <dd>
              {compared.length > 0
                ? compared
                    .map((id) => `${labels[id]}: ${documentTypeLabel(summary.document_types[id])}`)
                    .join(' · ')
                : '—'}
            </dd>
          </div>
        </dl>

        {compared.length >= 2 &&
          (summary.field_differences.length === 0 ? (
            <p className={styles.muted}>Every structured field agrees.</p>
          ) : (
            <>
              <p className={styles.subheading}>
                Fields that differ ({summary.field_differences.length})
              </p>
              <Table surface="plain" tableClassName={styles.grid}>
                <thead>
                  <tr>
                    <th>Sr No</th>
                    <th>Field</th>
                    {compared.map((id) => (
                      <th key={id}>{labels[id]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.field_differences.map((difference, index) => (
                    <tr key={difference.field}>
                      <td data-num>{index + 1}</td>
                      <td>{fieldLabel(difference.field)}</td>
                      {compared.map((id) => {
                        const value = difference.values[id] ?? null;
                        const shown = displayValue(difference.field, value, currency);
                        if (value === null) {
                          return (
                            <td key={id} data-muted>
                              not found
                            </td>
                          );
                        }
                        return isMoneyField(difference.field) && isNumeric(value) ? (
                          <td key={id} data-num>
                            {shown}
                          </td>
                        ) : (
                          <td key={id} data-wrap>
                            {shown}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          ))}
      </Panel>

      <div className={styles.sideBySide}>
        {results.map((result) => (
          <OcrResultView key={result.provider} result={result} label={labels[result.provider]} />
        ))}
      </div>
    </div>
  );
}
