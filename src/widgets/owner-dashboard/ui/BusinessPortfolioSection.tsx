import { useState } from 'react';
import {
  LayoutGrid,
  Table as TableIcon,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react';
import type { Business } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import { Sparkline } from '@/shared/ui';
import styles from './BusinessPortfolioSection.module.css';

interface BusinessPortfolioSectionProps {
  businesses: Business[];
  onSelectBusiness: (businessId: string) => void;
}

type SortField = 'name' | 'investment' | 'revenue' | 'expenses' | 'profit' | 'roi' | 'currentValue';

export function BusinessPortfolioSection({
  businesses,
  onSelectBusiness,
}: BusinessPortfolioSectionProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for financial figures
    }
  }

  const sortedBusinesses = [...businesses].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else {
      comparison = a[sortField] - b[sortField];
    }
    return sortAsc ? comparison : -comparison;
  });

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Business Portfolio</h2>
          <span className={styles.subtitle}>
            Overview of all 5 enterprise holdings &amp; operating companies
          </span>
        </div>

        <div className={styles.actions}>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid size={13} /> Cards
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleBtnActive : ''}`}
              onClick={() => setViewMode('table')}
            >
              <TableIcon size={13} /> Data Table
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className={styles.cardsGrid}>
          {sortedBusinesses.map((biz) => {
            const isProfit = biz.profit >= 0;
            const sparklineColor = isProfit ? '#15803d' : '#b91c1c';

            return (
              <div
                key={biz.id}
                className={styles.card}
                onClick={() => onSelectBusiness(biz.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectBusiness(biz.id)}
              >
                <div className={styles.cardTop}>
                  <div className={styles.bizHeader}>
                    <h4 className={styles.bizName}>{biz.name}</h4>
                    <span className={styles.bizMeta}>
                      <span>{biz.branchesCount} {biz.branchesCount === 1 ? 'branch' : 'branches'}</span>
                      <span>·</span>
                      <span>{biz.partnersCount} partners (25% each)</span>
                    </span>
                  </div>

                  <span
                    className={`${styles.statusIndicator} ${isProfit ? styles.statusGreen : styles.statusRed}`}
                  >
                    {isProfit ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {isProfit ? `ROI ${biz.roi.toFixed(1)}%` : `Loss ${biz.roi.toFixed(1)}%`}
                  </span>
                </div>

                <div className={styles.figuresGrid}>
                  <div className={styles.figure}>
                    <span className={styles.figureLabel}>Total Investment</span>
                    <span className={styles.figureValue}>{formatCrLakh(biz.investment)}</span>
                  </div>
                  <div className={styles.figure}>
                    <span className={styles.figureLabel}>Current Valuation</span>
                    <span className={styles.figureValue}>{formatCrLakh(biz.currentValue)}</span>
                  </div>
                  <div className={styles.figure}>
                    <span className={styles.figureLabel}>Revenue</span>
                    <span className={styles.figureValue}>{formatCrLakh(biz.revenue)}</span>
                  </div>
                  <div className={styles.figure}>
                    <span className={styles.figureLabel}>Expenses</span>
                    <span className={styles.figureValue}>{formatCrLakh(biz.expenses)}</span>
                  </div>
                </div>

                <div className={styles.cardProfitRow}>
                  <div className={styles.profitBox}>
                    <span className={styles.profitLabel}>Net Result</span>
                    <span
                      className={`${styles.profitAmount} ${isProfit ? styles.profitPositive : styles.profitNegative}`}
                    >
                      {formatCrLakh(biz.profit, { forceSign: true })}
                    </span>
                  </div>

                  <div className={styles.sparklineWrap}>
                    <Sparkline
                      values={biz.sparkline}
                      color={sparklineColor}
                      label={`${biz.shortName} profit trajectory`}
                    />
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span>Click to view business analytics</span>
                  <span className={styles.drillDownLink}>
                    View <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')}>
                  Business Name <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('investment')}>
                  Investment <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('revenue')}>
                  Revenue <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('expenses')}>
                  Expenses <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('profit')}>
                  Profit / Loss <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('roi')}>
                  ROI (%) <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th onClick={() => handleSort('currentValue')}>
                  Current Value <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4 }} />
                </th>
                <th>Branches</th>
                <th>Partners</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedBusinesses.map((biz) => {
                const isProfit = biz.profit >= 0;
                return (
                  <tr key={biz.id} onClick={() => onSelectBusiness(biz.id)}>
                    <td style={{ fontWeight: 600 }}>{biz.name}</td>
                    <td className={styles.mono}>{formatCrLakh(biz.investment)}</td>
                    <td className={styles.mono}>{formatCrLakh(biz.revenue)}</td>
                    <td className={styles.mono}>{formatCrLakh(biz.expenses)}</td>
                    <td
                      className={`${styles.monoBold} ${isProfit ? styles.profitPositive : styles.profitNegative}`}
                    >
                      {formatCrLakh(biz.profit, { forceSign: true })}
                    </td>
                    <td
                      className={`${styles.mono} ${isProfit ? styles.profitPositive : styles.profitNegative}`}
                    >
                      {biz.roi.toFixed(1)}%
                    </td>
                    <td className={styles.mono}>{formatCrLakh(biz.currentValue)}</td>
                    <td>{biz.branchesCount}</td>
                    <td>{biz.partnersCount} (25% each)</td>
                    <td>
                      <span className={styles.drillDownLink}>
                        Open <ArrowRight size={11} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
