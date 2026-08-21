import { useEffect, useState } from 'react';

import { getPartnerStatement, getRanking } from '@/entities/kg';
import type { Partner, PartnerStatement, PortfolioView } from '@/entities/kg';
import { Button, Input, Select, Badge, EmptyState, Loading } from '@/shared/ui';
import { getErrorMessage } from '@/shared/lib';

import styles from './KgPage.module.css';

export interface PortfolioPanelProps {
  companyId: string;
  partners: Partner[];
  businessCount: number;
}

const now = new Date();

/**
 * How every business did in one month, ranked, and what each partner is owed.
 *
 * Two things are shown that a dashboard usually hides. Businesses **still trading but yet to
 * report** are listed by name, so a short portfolio never reads as a complete one. And a target
 * verdict is left blank rather than shown as a failure where the ratio had no denominator — a
 * business with no turnover did not miss a margin target, it had no margin to measure.
 */
export function PortfolioPanel({ companyId, partners, businessCount }: PortfolioPanelProps) {
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [view, setView] = useState<PortfolioView | null>(null);
  const [statement, setStatement] = useState<PartnerStatement | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await getRanking(companyId, year, month);
        if (!cancelled) {
          setView(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load the portfolio'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, year, month]);

  async function showStatement() {
    if (!partnerId) return;
    setError(null);
    try {
      setStatement(await getPartnerStatement(companyId, partnerId, year, month));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not build the statement'));
    }
  }

  const target = (met: boolean | undefined) =>
    met === undefined ? (
      // Not a failure — there was nothing to measure.
      <span className={styles.hint}>—</span>
    ) : (
      <Badge variant={met ? 'success' : 'danger'}>{met ? 'Met' : 'Missed'}</Badge>
    );

  return (
    <div className={styles.panel}>
      <div className={styles.inlineForm}>
        <Input
          type="number"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          aria-label="Year"
        />
        <Select
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
          aria-label="Month"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {new Date(Date.UTC(2000, index, 1)).toLocaleString('en', { month: 'long' })}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <Loading label="Loading the portfolio…" />}

      {!loading && view && businessCount === 0 && (
        <EmptyState
          title="No businesses to compare yet"
          description="Add businesses on the Businesses tab, then upload a month's statement for each."
        />
      )}

      {!loading && view && businessCount > 0 && (
        <>
          {view.businesses.length === 0 ? (
            <EmptyState
              title="Nothing locked for this month"
              description="A business appears here once its statement has been imported and the snapshot locked."
            />
          ) : (
            <>
              <p className={styles.hint}>
                Targets: {view.targets.roiPercentPerMonth}% return and{' '}
                {view.targets.netMarginPercentPerMonth}% net margin a month. Amounts in{' '}
                {view.portfolioCurrency}.
              </p>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Business</th>
                    <th>Turnover</th>
                    <th>Net profit</th>
                    <th>Margin</th>
                    <th>Return</th>
                    <th>Margin target</th>
                    <th>Return target</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {view.businesses.map((row) => (
                    <tr key={row.businessId}>
                      <td className={styles.mono}>{row.rank}</td>
                      <td>
                        {row.businessName}
                        {row.reportingCurrency !== view.portfolioCurrency && (
                          <span className={styles.hint}> · from {row.reportingCurrency}</span>
                        )}
                      </td>
                      <td className={styles.mono}>{row.turnover}</td>
                      <td className={styles.mono}>{row.netProfit}</td>
                      <td className={styles.mono}>
                        {row.netMarginPercent ? `${row.netMarginPercent}%` : '—'}
                      </td>
                      <td className={styles.mono}>
                        {row.roiPercent ? `${row.roiPercent}%` : '—'}
                      </td>
                      <td>{target(row.meetsMarginTarget)}</td>
                      <td>{target(row.meetsRoiTarget)}</td>
                      <td className={styles.mono}>{row.score}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td>
                      <strong>{view.totals.businessCount} businesses</strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>{view.totals.turnover}</strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>{view.totals.netProfit}</strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>
                        {view.totals.netMarginPercent ? `${view.totals.netMarginPercent}%` : '—'}
                      </strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>{view.totals.roiPercent ? `${view.totals.roiPercent}%` : '—'}</strong>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {view.businessesWithoutLockedSnapshot.length > 0 && (
            <p className={styles.warn}>
              Still to report for this month:{' '}
              {view.businessesWithoutLockedSnapshot.join(', ')}. The totals above are short of them.
            </p>
          )}
        </>
      )}

      {partners.length > 0 && (
        <div className={styles.statement}>
          <h3 className={styles.sectionTitle}>Partner statement</h3>
          <div className={styles.inlineForm}>
            <Select
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              aria-label="Partner"
            >
              <option value="">Choose a partner…</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={showStatement} disabled={!partnerId}>
              Build statement
            </Button>
          </div>

          {statement && (
            <>
              <p className={styles.hint}>
                {statement.partnerName} · {statement.periodYear}-
                {String(statement.periodMonth).padStart(2, '0')} · {statement.currency}. This is what
                gets sent, so it shows their figures only.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Share</th>
                    <th>Their profit</th>
                    <th>Their capital</th>
                    <th>Their return</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.businesses.map((line) => (
                    <tr key={line.businessId}>
                      <td>{line.businessName}</td>
                      <td className={styles.mono}>{Number(line.profitSharePercent)}%</td>
                      <td className={styles.mono}>{line.yourProfitShare}</td>
                      <td className={styles.mono}>{line.yourCapital}</td>
                      <td className={styles.mono}>
                        {line.yourReturnPercent ? `${line.yourReturnPercent}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td />
                    <td className={styles.mono}>
                      <strong>{statement.totals.profitShare}</strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>{statement.totals.capital}</strong>
                    </td>
                    <td className={styles.mono}>
                      <strong>
                        {statement.totals.returnPercent
                          ? `${statement.totals.returnPercent}%`
                          : '—'}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
