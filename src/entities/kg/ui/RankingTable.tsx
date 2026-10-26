import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';

import { cn } from '@/shared/lib';
import { Table } from '@/shared/ui';

import { ratio } from '../model/format';
import type { PortfolioView } from '../model/types';

import styles from './Portfolio.module.css';

export interface RankingTableProps {
  view: PortfolioView;
  /** Writes an amount in the portfolio's currency, the way the company's country writes it. */
  money: (value: string) => string;
  /** Only the top few — a dashboard wants who leads, not the whole order. */
  limit?: number;
  /** Where a business's name leads. Plain text when not given. */
  linkTo?: string;
  /** The turnover column and the totals row — the full table, rather than the dashboard's. */
  full?: boolean;
}

/**
 * A ratio against its target: green with a tick when met, red with a cross when missed.
 *
 * A ratio with nothing to measure gets a dash and no verdict at all — a business with no turnover
 * did not miss a margin target, it had no margin. The verdict is also written out for a screen
 * reader, since the colour and the icon are the only things that carry it on screen.
 */
function Verdict({ value, met }: { value?: string; met?: boolean }) {
  if (value === undefined || met === undefined) return <span className={styles.nil}>—</span>;
  return (
    <span className={cn(styles.verdict, met ? styles.met : styles.missed)}>
      {met ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
      {ratio(value)}
      <span className={styles.srOnly}>{met ? 'met' : 'missed'}</span>
    </span>
  );
}

/**
 * The month's businesses in rank order, with each one's return and margin against target and the
 * weighted score that ordered them.
 *
 * The score bar is drawn against 100, which is what a business leading on every axis scores — so
 * its length says how far behind the leader a business is, not merely where it came.
 */
export function RankingTable({ view, money, limit, linkTo, full = false }: RankingTableProps) {
  const rows = limit ? view.businesses.slice(0, limit) : view.businesses;

  return (
    <Table surface="plain" stack zebra={false} className={styles.ranking}>
      <thead>
        <tr>
          <th>#</th>
          <th>Business</th>
          {full && <th data-num>Turnover</th>}
          <th data-num>Net profit</th>
          <th>Return</th>
          <th>Margin</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.businessId} className={styles.rankRow} style={{ '--i': i } as CSSProperties}>
            <td>
              <span className={cn(styles.rank, row.rank === 1 && styles.rankFirst)}>
                {row.rank ?? i + 1}
              </span>
            </td>
            <td>
              {linkTo ? (
                <Link className={styles.name} to={linkTo}>
                  {row.businessName}
                </Link>
              ) : (
                <span className={styles.name}>{row.businessName}</span>
              )}
              <span className={styles.from}>
                {row.reportingCurrency === view.portfolioCurrency
                  ? `Reports in ${row.reportingCurrency}`
                  : `Reports in ${row.reportingCurrency} · converted to ${view.portfolioCurrency}`}
                {row.figureSource === 'KEYED' && ' · keyed result, ranked on return and profit'}
              </span>
            </td>
            {full && (
              <td data-num>
                {row.turnover === undefined ? (
                  <span className={styles.nil}>—</span>
                ) : (
                  money(row.turnover)
                )}
              </td>
            )}
            <td data-num className={cn(Number(row.netProfit) < 0 && styles.negative)}>
              {money(row.netProfit)}
            </td>
            <td>
              <Verdict value={row.roiPercent} met={row.meetsRoiTarget} />
            </td>
            <td>
              <Verdict value={row.netMarginPercent} met={row.meetsMarginTarget} />
            </td>
            <td>
              {row.score === undefined ? (
                <span className={styles.nil}>—</span>
              ) : (
                <span className={styles.score}>
                  <span className={styles.scoreTrack} aria-hidden="true">
                    <span
                      className={styles.scoreFill}
                      style={{ width: `${Math.max(0, Math.min(100, Number(row.score)))}%` }}
                    />
                  </span>
                  <span className={styles.scoreValue}>{Number(row.score).toFixed(0)}</span>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      {full && (
        <tfoot>
          <tr>
            <td />
            <td>
              <strong>
                {view.totals.businessCount} business{view.totals.businessCount === 1 ? '' : 'es'}
              </strong>
            </td>
            <td data-num>
              <strong>{money(view.totals.turnover)}</strong>
            </td>
            <td data-num>
              <strong>{money(view.totals.netProfit)}</strong>
            </td>
            <td>
              <strong>{ratio(view.totals.roiPercent)}</strong>
            </td>
            <td>
              <strong>{ratio(view.totals.netMarginPercent)}</strong>
            </td>
            <td />
          </tr>
        </tfoot>
      )}
    </Table>
  );
}
