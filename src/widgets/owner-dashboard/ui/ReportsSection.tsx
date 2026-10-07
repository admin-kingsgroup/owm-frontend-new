import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Printer,
  Download,
  BookOpen,
  TrendingUp,
  Scale,
  Calendar,
  DollarSign,
  Users,
  Eye,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { Business, Branch } from '@/entities/owner-portfolio';
import {
  exportBusinessReportCsv,
  exportBranchReportCsv,
  exportPartnerDistributionCsv,
  triggerExecutivePrint,
} from '@/entities/owner-portfolio';
import {
  MOCK_COMPANIES,
  getMockBalanceSheet,
  getMockProfitAndLoss,
  getMockTrialBalance,
  getMockDayBook,
  getMockCashFlow,
  getMockOutstandings,
} from '@/shared/api/mock-erp-data';
import styles from './ReportsSection.module.css';

interface ReportsSectionProps {
  businesses: Business[];
  branches: Branch[];
  initialBusinessId?: string;
}

type ReportSubTab = 'statements' | 'exports';
type StatementPreviewType =
  | 'balance-sheet'
  | 'profit-and-loss'
  | 'trial-balance'
  | 'day-book'
  | 'cash-flow'
  | 'outstandings'
  | null;

export function ReportsSection({
  businesses,
  branches,
  initialBusinessId = 'biz-travkings',
}: ReportsSectionProps) {
  const [activeTab, setActiveTab] = useState<ReportSubTab>('statements');
  const [selectedBizId, setSelectedBizId] = useState<string>(initialBusinessId);
  const [previewModal, setPreviewModal] = useState<StatementPreviewType>(null);

  React.useEffect(() => {
    if (initialBusinessId) {
      setSelectedBizId(initialBusinessId);
    }
  }, [initialBusinessId]);

  const activeCompany = useMemo(
    () => MOCK_COMPANIES.find((c) => c.id === selectedBizId) || MOCK_COMPANIES[0],
    [selectedBizId]
  );

  // Statement mock data for the selected business
  const balanceSheetData = useMemo(() => getMockBalanceSheet(selectedBizId), [selectedBizId]);
  const pnlData = useMemo(() => getMockProfitAndLoss(selectedBizId), [selectedBizId]);
  const trialBalanceData = useMemo(() => getMockTrialBalance(selectedBizId), [selectedBizId]);
  const dayBookData = useMemo(() => getMockDayBook(selectedBizId), [selectedBizId]);
  const cashFlowData = useMemo(() => getMockCashFlow(selectedBizId), [selectedBizId]);
  const outstandingsReceivable = useMemo(() => getMockOutstandings(selectedBizId, 'DEBIT'), [selectedBizId]);
  const outstandingsPayable = useMemo(() => getMockOutstandings(selectedBizId, 'CREDIT'), [selectedBizId]);

  function handleDownloadBusinessReport() {
    exportBusinessReportCsv(businesses);
  }

  function handleDownloadBranchReport() {
    exportBranchReportCsv(branches);
  }

  function handleDownloadPartnerReport() {
    exportPartnerDistributionCsv(businesses);
  }

  function handlePrintExecutive() {
    triggerExecutivePrint();
  }

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Financial Reports &amp; Statements Hub</h2>
        </div>
        <span className={styles.subtitle}>
          Audited statutory statements, double-entry trial balances, day books, and 4-partner dividend exports
        </span>
      </div>

      {/* Sub tabs and Company Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div className={styles.subTabs}>
          <button
            className={`${styles.subTabBtn} ${activeTab === 'statements' ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            <span>Core Financial Statements</span>
            <span className={styles.badge}>6</span>
          </button>

          <button
            className={`${styles.subTabBtn} ${activeTab === 'exports' ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab('exports')}
          >
            <span>Executive Dossiers &amp; Exports</span>
            <span className={styles.badge}>4</span>
          </button>
        </div>

        {activeTab === 'statements' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', fontWeight: 600 }}>
              Entity:
            </span>
            <select
              value={selectedBizId}
              onChange={(e) => setSelectedBizId(e.target.value)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--paper-card)',
                color: 'var(--ink)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {MOCK_COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: Core Financial Statements */}
      {activeTab === 'statements' && (
        <div className={styles.grid}>
          {/* 1. Balance Sheet */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <Scale size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Balance Sheet</h4>
                  <span className={styles.shortcutBadge}>Alt+B</span>
                </div>
                <span className={styles.reportMeta}>
                  Liabilities &amp; Equity = Assets · FY 2026-27
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Statement of financial position showing partner capital accounts, reserves, bank deposits, and client balances. Books are fully balanced.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Total Assets:{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  ₹{Number(balanceSheetData.totals.assets).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className={styles.statPill}>
                Balanced:{' '}
                <strong style={{ color: 'var(--success-fg)' }}>
                  {balanceSheetData.totals.difference === '0.00' ? 'Yes (₹0 Diff)' : 'No'}
                </strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('balance-sheet')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/balance-sheet`}
                className={styles.downloadBtn}
              >
                <span>Full Statement →</span>
              </Link>
            </div>
          </div>

          {/* 2. Profit & Loss */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <TrendingUp size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Profit &amp; Loss Statement</h4>
                  <span className={styles.shortcutBadge}>Alt+P</span>
                </div>
                <span className={styles.reportMeta}>
                  Trading &amp; P&amp;L Account · Income vs Expense
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Income statement comparing tour bookings, airline commissions, fleet logistics income against operating expenses and salaries.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Gross Incomes:{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  ₹{Number(pnlData.totals.income).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className={styles.statPill}>
                Net Profit:{' '}
                <strong style={{ color: 'var(--success-fg)' }}>
                  ₹{Number(pnlData.totals.netProfit).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('profit-and-loss')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/profit-and-loss`}
                className={styles.downloadBtn}
              >
                <span>Full Statement →</span>
              </Link>
            </div>
          </div>

          {/* 3. Trial Balance */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <BookOpen size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Trial Balance</h4>
                </div>
                <span className={styles.reportMeta}>
                  Debit / Credit Equality Across All Groups
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Double-entry audit schedule verifying that total debit balances equal credit balances for all chart of accounts nodes.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Total Dr:{' '}
                <strong className={styles.mono}>
                  ₹{Number(trialBalanceData.totals.debit).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className={styles.statPill}>
                Status:{' '}
                <strong style={{ color: 'var(--success-fg)' }}>Balanced</strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('trial-balance')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/trial-balance`}
                className={styles.downloadBtn}
              >
                <span>Full Trial Balance →</span>
              </Link>
            </div>
          </div>

          {/* 4. Day Book */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <Calendar size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Day Book</h4>
                  <span className={styles.shortcutBadge}>Alt+K</span>
                </div>
                <span className={styles.reportMeta}>
                  Chronological Transaction Register
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Daily journal register recording all bank payments, client receipts, sales invoices, and supplier billing events for the entity.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Total Entries:{' '}
                <strong>{dayBookData.rows.length} Vouchers</strong>
              </div>
              <div className={styles.statPill}>
                Day Volume:{' '}
                <strong className={styles.mono}>
                  ₹{Number(dayBookData.total).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('day-book')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/day-book`}
                className={styles.downloadBtn}
              >
                <span>Full Day Book →</span>
              </Link>
            </div>
          </div>

          {/* 5. Cash Flow Statement */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <DollarSign size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Cash Flow Statement</h4>
                </div>
                <span className={styles.reportMeta}>
                  Operating, Investing &amp; Financing Activities
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Cash flow breakdown tracking net operational cash generation, capital fleet purchases, and partner equity distributions.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Net Cash Flow:{' '}
                <strong style={{ color: 'var(--success-fg)' }}>
                  ₹{Number(cashFlowData.totals.netChange).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className={styles.statPill}>
                Closing Cash:{' '}
                <strong className={styles.mono}>
                  ₹{Number(cashFlowData.closingBalance).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('cash-flow')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/cash-flow`}
                className={styles.downloadBtn}
              >
                <span>Full Statement →</span>
              </Link>
            </div>
          </div>

          {/* 6. Outstandings (Receivables & Payables) */}
          <div className={styles.statementCard}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <Users size={20} />
              </div>
              <div className={styles.cardTitles}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 className={styles.reportName}>Outstanding Receivables &amp; Payables</h4>
                </div>
                <span className={styles.reportMeta}>
                  Customer Aging &amp; Supplier Obligations
                </span>
              </div>
            </div>
            <p className={styles.description}>
              Receivables aging schedule from clients (Al Habtoor, Royal Holidays) and vendor liabilities (Emirates, Marriott).
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className={styles.statPill}>
                Receivables:{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  ₹{Number(outstandingsReceivable.totals.outstanding).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className={styles.statPill}>
                Payables:{' '}
                <strong style={{ color: '#ea580c' }}>
                  ₹{Number(outstandingsPayable.totals.outstanding).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={() => setPreviewModal('outstandings')}
              >
                <Eye size={13} /> Quick Preview
              </button>
              <Link
                to={`/companies/${selectedBizId}/reports/outstandings`}
                className={styles.downloadBtn}
              >
                <span>Aging Schedule →</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Executive Dossiers & Exports (Original Portfolio Reports Preserved) */}
      {activeTab === 'exports' && (
        <div className={styles.grid}>
          {/* Report 1: Travkings Monthly Business Report */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <FileSpreadsheet size={20} />
              </div>
              <div className={styles.cardTitles}>
                <h4 className={styles.reportName}>Travkings — Monthly Business Report</h4>
                <span className={styles.reportMeta}>5 Hubs · Revenue ₹11.8 Cr · Profit ₹2.4 Cr</span>
              </div>
            </div>
            <p className={styles.description}>
              Comprehensive operational statement including hub revenues, vehicle fleet maintenance costs, fuel surcharges, and partner net dividend allocations.
            </p>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={handleDownloadBranchReport}
              >
                <Download size={13} /> Export Excel / CSV
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handlePrintExecutive}
              >
                <Printer size={13} /> Print PDF
              </button>
            </div>
          </div>

          {/* Report 2: MHUB Branch Performance Report */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <FileSpreadsheet size={20} />
              </div>
              <div className={styles.cardTitles}>
                <h4 className={styles.reportName}>MHUB — Branch Performance Report</h4>
                <span className={styles.reportMeta}>Top Performer · ₹60L Profit · 50% ROI</span>
              </div>
            </div>
            <p className={styles.description}>
              Granular terminal and fleet economics for the flagship MHUB regional center, tracking 6-month revenue progression and driver crew expense line items.
            </p>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={handleDownloadBranchReport}
              >
                <Download size={13} /> Download Report
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handlePrintExecutive}
              >
                <Printer size={13} /> Export PDF
              </button>
            </div>
          </div>

          {/* Report 3: Partner Profit Distribution Report */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <FileSpreadsheet size={20} />
              </div>
              <div className={styles.cardTitles}>
                <h4 className={styles.reportName}>Partner Profit Distribution Report</h4>
                <span className={styles.reportMeta}>4 Partners · 25% Equal Share · All 5 Entities</span>
              </div>
            </div>
            <p className={styles.description}>
              Formal dividend schedule demonstrating dynamic 25% equal allocation of portfolio net profits, including loss contributions for underperforming units.
            </p>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={handleDownloadPartnerReport}
              >
                <Download size={13} /> Export Excel / CSV
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handlePrintExecutive}
              >
                <Printer size={13} /> Print Summary
              </button>
            </div>
          </div>

          {/* Report 4: Master Portfolio Valuation & Statement */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrap}>
                <FileSpreadsheet size={20} />
              </div>
              <div className={styles.cardTitles}>
                <h4 className={styles.reportName}>Master Portfolio Business Statement</h4>
                <span className={styles.reportMeta}>₹12.8 Cr Capital · ₹17.4 Cr Valuation</span>
              </div>
            </div>
            <p className={styles.description}>
              Executive summary for private family office, bank covenants, and tax advisors covering Travkings, QuinALiza, Kings Logistic, Hotel Kings Palace, and Techkings.
            </p>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={`${styles.downloadBtn} ${styles.primaryBtn}`}
                onClick={handleDownloadBusinessReport}
              >
                <Download size={13} /> Export Master Excel
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={handlePrintExecutive}
              >
                <Printer size={13} /> Print Executive PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal */}
      {previewModal && (
        <div className={styles.modalOverlay} onClick={() => setPreviewModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {previewModal === 'balance-sheet' && `Balance Sheet — ${activeCompany.name}`}
                {previewModal === 'profit-and-loss' && `Profit & Loss Statement — ${activeCompany.name}`}
                {previewModal === 'trial-balance' && `Trial Balance — ${activeCompany.name}`}
                {previewModal === 'day-book' && `Day Book Register — ${activeCompany.name}`}
                {previewModal === 'cash-flow' && `Cash Flow Statement — ${activeCompany.name}`}
                {previewModal === 'outstandings' && `Aging & Outstandings — ${activeCompany.name}`}
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setPreviewModal(null)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {previewModal === 'balance-sheet' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Liabilities &amp; Equity</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {balanceSheetData.liabilities.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(item.balance).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Liabilities &amp; Capital</td>
                            <td style={{ textAlign: 'right' }} className={styles.mono}>
                              ₹{Number(balanceSheetData.totals.liabilities).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Assets</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {balanceSheetData.assets.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(item.balance).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Assets</td>
                            <td style={{ textAlign: 'right' }} className={styles.mono}>
                              ₹{Number(balanceSheetData.totals.assets).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--paper-sunken)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--success-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Both sides balance perfectly: ₹{Number(balanceSheetData.totals.assets).toLocaleString('en-IN')}
                    </span>
                    <Link
                      to={`/companies/${selectedBizId}/reports/balance-sheet`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Statement →
                    </Link>
                  </div>
                </div>
              )}

              {previewModal === 'profit-and-loss' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Incomes &amp; Revenues</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {pnlData.income.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(item.balance).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Revenue</td>
                            <td style={{ textAlign: 'right', color: 'var(--accent)' }} className={styles.mono}>
                              ₹{Number(pnlData.totals.income).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Expenses &amp; Overheads</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {pnlData.expenses.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(item.balance).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Expenses</td>
                            <td style={{ textAlign: 'right', color: 'var(--danger-fg)' }} className={styles.mono}>
                              ₹{Number(pnlData.totals.expenses).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--paper-sunken)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: 'var(--success-fg)', fontWeight: 700 }}>
                      Net Profit: ₹{Number(pnlData.totals.netProfit).toLocaleString('en-IN')}
                    </span>
                    <Link
                      to={`/companies/${selectedBizId}/reports/profit-and-loss`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Statement →
                    </Link>
                  </div>
                </div>
              )}

              {previewModal === 'trial-balance' && (
                <div>
                  <table className={styles.statementTable}>
                    <thead>
                      <tr>
                        <th>Account Name</th>
                        <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                        <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalanceData.rows.map((row) => (
                        <tr key={row.ledgerId}>
                          <td>{row.name}</td>
                          <td style={{ textAlign: 'right' }} className={styles.mono}>
                            {row.debit !== '0.00' && row.debit !== '0' ? `₹${Number(row.debit).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }} className={styles.mono}>
                            {row.credit !== '0.00' && row.credit !== '0' ? `₹${Number(row.credit).toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td>Grand Total</td>
                        <td style={{ textAlign: 'right' }} className={styles.mono}>
                          ₹{Number(trialBalanceData.totals.debit).toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }} className={styles.mono}>
                          ₹{Number(trialBalanceData.totals.credit).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link
                      to={`/companies/${selectedBizId}/reports/trial-balance`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Trial Balance →
                    </Link>
                  </div>
                </div>
              )}

              {previewModal === 'day-book' && (
                <div>
                  <table className={styles.statementTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher #</th>
                        <th>Type</th>
                        <th>Narration</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayBookData.rows.slice(0, 10).map((e) => (
                        <tr key={e.voucherId}>
                          <td className={styles.mono}>{e.voucherDate}</td>
                          <td className={styles.mono} style={{ fontWeight: 600 }}>{e.voucherNumber}</td>
                          <td>{e.voucherTypeCode}</td>
                          <td>{e.narration || '—'}</td>
                          <td style={{ textAlign: 'right' }} className={styles.mono}>
                            ₹{Number(e.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link
                      to={`/companies/${selectedBizId}/reports/day-book`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Day Book →
                    </Link>
                  </div>
                </div>
              )}

              {previewModal === 'cash-flow' && (
                <div>
                  <table className={styles.statementTable}>
                    <tbody>
                      <tr>
                        <td><strong>Inflow (Operations &amp; Client Receipts)</strong></td>
                        <td style={{ textAlign: 'right' }} className={styles.mono}>
                          ₹{Number(cashFlowData.totals.inflow).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Outflow (Salaries, Fleet &amp; Overhead Payments)</strong></td>
                        <td style={{ textAlign: 'right', color: 'var(--danger-fg)' }} className={styles.mono}>
                          ₹{Number(cashFlowData.totals.outflow).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td>Net Cash Increase / (Decrease)</td>
                        <td style={{ textAlign: 'right', color: 'var(--success-fg)' }} className={styles.mono}>
                          ₹{Number(cashFlowData.totals.netChange).toLocaleString('en-IN')}
                        </td>
                      </tr>
                      <tr style={{ fontWeight: 700 }}>
                        <td>Closing Cash &amp; Bank Balance</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent)' }} className={styles.mono}>
                          ₹{Number(cashFlowData.closingBalance).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link
                      to={`/companies/${selectedBizId}/reports/cash-flow`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Cash Flow Statement →
                    </Link>
                  </div>
                </div>
              )}

              {previewModal === 'outstandings' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Debtors (Customer Receivables)</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {outstandingsReceivable.bills.map((r) => (
                            <tr key={r.billId}>
                              <td>{r.ledgerName}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(r.outstanding).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Receivables</td>
                            <td style={{ textAlign: 'right', color: 'var(--accent)' }} className={styles.mono}>
                              ₹{Number(outstandingsReceivable.totals.outstanding).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--ink)' }}>Creditors (Vendor Payables)</h4>
                      <table className={styles.statementTable}>
                        <tbody>
                          {outstandingsPayable.bills.map((p) => (
                            <tr key={p.billId}>
                              <td>{p.ledgerName}</td>
                              <td style={{ textAlign: 'right' }} className={styles.mono}>
                                ₹{Number(p.outstanding).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td>Total Payables</td>
                            <td style={{ textAlign: 'right', color: '#ea580c' }} className={styles.mono}>
                              ₹{Number(outstandingsPayable.totals.outstanding).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <Link
                      to={`/companies/${selectedBizId}/reports/outstandings`}
                      style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                    >
                      Open Full Aging Schedule →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
