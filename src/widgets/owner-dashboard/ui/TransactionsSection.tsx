import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Plus, ArrowUpRight, ArrowDownLeft, FileText, X } from 'lucide-react';
import type { FinancialTransaction, TransactionType } from '@/entities/owner-portfolio';
import { formatCrLakh } from '@/entities/owner-portfolio';
import {
  MOCK_COMPANIES,
  getMockVouchers,
  getMockLedgers,
  getMockVoucherTypes,
  getMockCurrencies,
} from '@/shared/api/mock-erp-data';
import type { Voucher } from '@/entities/voucher';
import { CreateVoucherForm } from '@/features/voucher/create-voucher';
import styles from './TransactionsSection.module.css';

interface TransactionsSectionProps {
  transactions: FinancialTransaction[];
  initialBusinessId?: string;
}

export function TransactionsSection({
  transactions,
  initialBusinessId = 'biz-travkings',
}: TransactionsSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<'vouchers' | 'cashflow'>('vouchers');
  const [selectedBizId, setSelectedBizId] = useState<string>(initialBusinessId);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Voucher creation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetVoucherTypeCode, setTargetVoucherTypeCode] = useState<string>('PAYMENT');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sync initialBusinessId
  useEffect(() => {
    if (initialBusinessId) {
      setSelectedBizId(initialBusinessId);
    }
  }, [initialBusinessId]);

  const activeCompany = useMemo(
    () => MOCK_COMPANIES.find((c) => c.id === selectedBizId) || MOCK_COMPANIES[0],
    [selectedBizId]
  );

  const vouchers = useMemo(() => {
    // Read from mock storage layer (which includes newly created vouchers)
    return getMockVouchers(selectedBizId);
  }, [selectedBizId, refreshTrigger]);

  const ledgers = useMemo(() => getMockLedgers(selectedBizId), [selectedBizId]);
  const voucherTypes = useMemo(() => getMockVoucherTypes(selectedBizId), [selectedBizId]);
  const currencies = useMemo(() => getMockCurrencies(selectedBizId), [selectedBizId]);

  const ledgerMap = useMemo(() => {
    const map = new Map<string, string>();
    ledgers.forEach((l) => map.set(l.code, l.name));
    return map;
  }, [ledgers]);

  // Keyboard shortcut listener for Alt+F4 to Alt+F9
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === 'F5') {
          e.preventDefault();
          openCreateModal('PAYMENT');
        } else if (e.key === 'F6') {
          e.preventDefault();
          openCreateModal('RECEIPT');
        } else if (e.key === 'F8') {
          e.preventDefault();
          openCreateModal('SALES');
        } else if (e.key === 'F9') {
          e.preventDefault();
          openCreateModal('PURCHASE');
        } else if (e.key === 'F7') {
          e.preventDefault();
          openCreateModal('JOURNAL');
        } else if (e.key === 'F4') {
          e.preventDefault();
          openCreateModal('CONTRA');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBizId]);

  function openCreateModal(typeCode: string) {
    setTargetVoucherTypeCode(typeCode);
    setModalOpen(true);
  }

  // Filtered Cash Flows (Original Portfolio Transactions)
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

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((vch) => {
      const vt = voucherTypes.find((t) => t.id === vch.voucherTypeId);
      const category = vt?.category || '';
      const matchType = filterType === 'ALL' || category === filterType;
      const matchSearch =
        searchTerm.trim() === '' ||
        vch.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vch.narration && vch.narration.toLowerCase().includes(searchTerm.toLowerCase())) ||
        vch.entries.some((e) => e.ledgerCode.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [vouchers, voucherTypes, filterType, searchTerm]);

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

  function getVoucherCategoryBadge(category?: string) {
    switch (category) {
      case 'PAYMENT':
        return styles.btnPayment;
      case 'RECEIPT':
        return styles.btnReceipt;
      case 'SALES':
        return styles.btnSales;
      case 'PURCHASE':
        return styles.btnPurchase;
      case 'JOURNAL':
        return styles.btnJournal;
      case 'CONTRA':
        return styles.btnContra;
      default:
        return '';
    }
  }

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Transactions &amp; Vouchers Center</h2>
        </div>
        <span className={styles.subtitle}>
          Execute double-entry accounting vouchers, manage operating cash flows, and trace entity ledgers
        </span>
      </div>

      {/* Quick Action Bar for Instant Voucher Creation */}
      <div className={styles.quickBar}>
        <span className={styles.quickBarLabel}>Quick Actions:</span>

        <button
          className={`${styles.quickBtn} ${styles.btnPayment}`}
          onClick={() => openCreateModal('PAYMENT')}
          title="Create Payment Voucher (Alt+F5)"
        >
          <ArrowDownLeft size={13} />
          <span>+ Payment</span>
          <span className={styles.shortcutTag}>Alt+F5</span>
        </button>

        <button
          className={`${styles.quickBtn} ${styles.btnReceipt}`}
          onClick={() => openCreateModal('RECEIPT')}
          title="Create Receipt Voucher (Alt+F6)"
        >
          <ArrowUpRight size={13} />
          <span>+ Receipt</span>
          <span className={styles.shortcutTag}>Alt+F6</span>
        </button>

        <button
          className={`${styles.quickBtn} ${styles.btnSales}`}
          onClick={() => openCreateModal('SALES')}
          title="Create Sales & Income Invoice (Alt+F8)"
        >
          <FileText size={13} />
          <span>+ Income / Sales</span>
          <span className={styles.shortcutTag}>Alt+F8</span>
        </button>

        <button
          className={`${styles.quickBtn} ${styles.btnPurchase}`}
          onClick={() => openCreateModal('PURCHASE')}
          title="Create Purchase & Expense Voucher (Alt+F9)"
        >
          <FileText size={13} />
          <span>+ Expense / Purchase</span>
          <span className={styles.shortcutTag}>Alt+F9</span>
        </button>

        <button
          className={`${styles.quickBtn} ${styles.btnJournal}`}
          onClick={() => openCreateModal('JOURNAL')}
          title="Create Journal Voucher (Alt+F7)"
        >
          <Plus size={13} />
          <span>+ Journal</span>
          <span className={styles.shortcutTag}>Alt+F7</span>
        </button>

        <button
          className={`${styles.quickBtn} ${styles.btnContra}`}
          onClick={() => openCreateModal('CONTRA')}
          title="Create Bank / Cash Contra Transfer (Alt+F4)"
        >
          <Plus size={13} />
          <span>+ Contra</span>
          <span className={styles.shortcutTag}>Alt+F4</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-faint)', fontWeight: 600 }}>
            Active Business:
          </span>
          <select
            value={selectedBizId}
            onChange={(e) => setSelectedBizId(e.target.value)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--paper-card)',
              color: 'var(--ink)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {MOCK_COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub Tabs: Double-Entry Vouchers vs Portfolio Cash Flows */}
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTabBtn} ${activeSubTab === 'vouchers' ? styles.subTabActive : ''}`}
          onClick={() => {
            setActiveSubTab('vouchers');
            setFilterType('ALL');
          }}
        >
          <span>Double-Entry Vouchers Ledger</span>
          <span className={styles.badge}>{vouchers.length}</span>
        </button>

        <button
          className={`${styles.subTabBtn} ${activeSubTab === 'cashflow' ? styles.subTabActive : ''}`}
          onClick={() => {
            setActiveSubTab('cashflow');
            setFilterType('ALL');
          }}
        >
          <span>Portfolio Cash Flow Feed</span>
          <span className={styles.badge}>{transactions.length}</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className={styles.filtersBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={
            activeSubTab === 'vouchers'
              ? 'Search by voucher #, account or narration...'
              : 'Search by business, branch or category...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {activeSubTab === 'vouchers' ? (
          <select
            className={styles.typeSelect}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Voucher Types</option>
            <option value="PAYMENT">Payments (PMT)</option>
            <option value="RECEIPT">Receipts (RCT)</option>
            <option value="SALES">Sales / Incomes (INV)</option>
            <option value="PURCHASE">Purchases / Expenses (PUR)</option>
            <option value="JOURNAL">Journal Adjustments (JRN)</option>
            <option value="CONTRA">Cash / Bank Transfers (CNT)</option>
          </select>
        ) : (
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
        )}
      </div>

      {/* View 1: Double-Entry Vouchers Ledger */}
      {activeSubTab === 'vouchers' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Voucher #</th>
                <th style={{ width: '95px' }}>Date</th>
                <th style={{ width: '100px' }}>Type</th>
                <th>Debit Account(s) / Narration</th>
                <th>Credit Account(s)</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Amount</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-faint)' }}>
                    No vouchers found for {activeCompany.name}. Use the quick action buttons above to record one.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((vch) => {
                  const vt = voucherTypes.find((t) => t.id === vch.voucherTypeId);
                  const debitEntries = vch.entries.filter((e) => Number(e.debit) > 0);
                  const creditEntries = vch.entries.filter((e) => Number(e.credit) > 0);

                  return (
                    <tr key={vch.id}>
                      <td className={styles.monoBold} style={{ color: 'var(--accent)' }}>
                        {vch.voucherNumber}
                      </td>
                      <td className={styles.mono}>{vch.voucherDate}</td>
                      <td>
                        <span
                          className={`${styles.typeBadge} ${getVoucherCategoryBadge(vt?.category)}`}
                        >
                          {vt?.name || 'Voucher'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {debitEntries
                            .map((d) => ledgerMap.get(d.ledgerCode) || d.ledgerCode)
                            .join(', ')}
                        </div>
                        {vch.narration && (
                          <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '2px' }}>
                            {vch.narration}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: 'var(--ink)' }}>
                          {creditEntries
                            .map((c) => ledgerMap.get(c.ledgerCode) || c.ledgerCode)
                            .join(', ')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} className={styles.monoBold}>
                        ₹{Number(vch.amount).toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={styles.statusCompleted}>
                          <CheckCircle2 size={12} /> {vch.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View 2: Portfolio Cash Flow Feed */}
      {activeSubTab === 'cashflow' && (
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
      )}

      {/* Voucher Creation Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                New Voucher — {activeCompany.name}
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setModalOpen(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <CreateVoucherForm
                companyId={selectedBizId}
                voucherTypes={voucherTypes}
                ledgers={ledgers}
                billWiseEnabled={true}
                multiCurrencyEnabled={true}
                currencies={currencies}
                baseCurrency={activeCompany.baseCurrency || 'INR'}
                initialVoucherTypeCode={targetVoucherTypeCode}
                onCreated={(_newVoucher: Voucher) => {
                  setModalOpen(false);
                  setRefreshTrigger((prev) => prev + 1);
                  setActiveSubTab('vouchers');
                }}
                onCancel={() => setModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
