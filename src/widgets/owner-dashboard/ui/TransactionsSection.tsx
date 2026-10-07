import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { FinancialTransaction, TransactionType } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import styles from './TransactionsSection.module.css';

interface TransactionsSectionProps {
  transactions: FinancialTransaction[];
}

export function TransactionsSection({ transactions }: TransactionsSectionProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = filterType === 'ALL' || tx.type === filterType;
      const matchSearch =
        searchTerm.trim() === '' ||
        tx.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.branch && tx.branch.toLowerCase().includes(searchTerm.toLowerCase())) ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
  }, [transactions, filterType, searchTerm]);

  function getTypeBadgeClass(type: TransactionType) {
    switch (type) {
      case 'Investment':
        return styles.typeInvestment;
      case 'Revenue':
        return styles.typeRevenue;
      case 'Expense':
        return styles.typeExpense;
      case 'Profit':
        return styles.typeProfit;
      case 'Withdrawal':
        return styles.typeWithdrawal;
      case 'Partner Distribution':
        return styles.typeDistribution;
      default:
        return '';
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Recent Financial Activity &amp; Transactions</h2>
        </div>
        <span className={styles.subtitle}>
          Chronological record of investments, operating cash flows, withdrawals, and partner dividend payouts
        </span>
      </div>

      <div className={styles.filtersBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by business, branch or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className={styles.typeSelect}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="ALL">All Transaction Types</option>
          <option value="Investment">Investment</option>
          <option value="Revenue">Revenue</option>
          <option value="Expense">Expense</option>
          <option value="Profit">Profit</option>
          <option value="Withdrawal">Withdrawal</option>
          <option value="Partner Distribution">Partner Distribution</option>
        </select>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Business Entity</th>
              <th>Branch</th>
              <th>Activity Type</th>
              <th>Amount</th>
              <th>Category / Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className={styles.mono}>{tx.date}</td>
                <td style={{ fontWeight: 600 }}>{tx.business}</td>
                <td className={styles.mono}>{tx.branch ?? '—'}</td>
                <td>
                  <span className={`${styles.typeBadge} ${getTypeBadgeClass(tx.type)}`}>
                    {tx.type}
                  </span>
                </td>
                <td
                  className={styles.monoBold}
                  style={{
                    color:
                      tx.type === 'Revenue' || tx.type === 'Profit'
                        ? 'var(--success-fg)'
                        : tx.type === 'Expense' || tx.type === 'Withdrawal'
                          ? 'var(--danger-fg)'
                          : 'var(--ink)',
                  }}
                >
                  {formatCrLakh(tx.amount)}
                </td>
                <td>{tx.category}</td>
                <td>
                  <span className={styles.statusCompleted}>
                    <CheckCircle2 size={12} /> {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
