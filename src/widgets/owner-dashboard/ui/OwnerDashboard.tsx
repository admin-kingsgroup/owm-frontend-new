import { useMemo } from 'react';
import {
  ArrowRight,
  LayoutDashboard,
  Building2,
  MapPin,
  Users,
  Menu,
} from 'lucide-react';
import {
  usePortfolioStore,
  calculatePortfolioTotals,
  formatCrLakh,
  portfolioMonthlyData,
} from '@/entities/owner-portfolio';
import { OwnerSidebar } from './OwnerSidebar';
import { OwnerHeader } from './OwnerHeader';
import { OwnerBreadcrumbs } from './OwnerBreadcrumbs';
import { KpiCards } from './KpiCards';
import { BusinessPortfolioSection } from './BusinessPortfolioSection';
import { TravkingsBranchSection } from './TravkingsBranchSection';
import { BranchDrillDownView } from './BranchDrillDownView';
import { PartnerDistributionSection } from './PartnerDistributionSection';
import { InvestmentOverviewSection } from './InvestmentOverviewSection';
import { PerformanceSection } from './PerformanceSection';
import { TransactionsSection } from './TransactionsSection';
import { ReportsSection } from './ReportsSection';
import { BusinessInsightsSection } from './BusinessInsightsSection';
import { BusinessPerformanceChart } from './BusinessPerformanceChart';
import { InvestmentAllocationDonut } from './InvestmentAllocationDonut';
import { BranchComparisonChart } from './BranchComparisonChart';
import { FinancialPerformanceCombinedChart } from './FinancialPerformanceCombinedChart';
import { PartnerShareDonut } from './PartnerShareDonut';
import styles from './OwnerDashboard.module.css';

interface OwnerDashboardProps {
  onOpenNewCompanyModal?: () => void;
  renderAccountingBooks?: () => React.ReactNode;
}

export function OwnerDashboard({
  onOpenNewCompanyModal,
  renderAccountingBooks,
}: OwnerDashboardProps) {
  const {
    businesses,
    travkingsBranches,
    transactions,
    dateFilter,
    selectedBusinessId,
    selectedBranchId,
    activeTab,
    drillDownBranchId,
    drillDownBusinessId,
    sidebarCollapsed,
    mobileMenuOpen,
    setDateFilter,
    setSelectedBusinessId,
    setSelectedBranchId,
    setActiveTab,
    drillDownToBranch,
    drillDownToBusiness,
    resetDrillDown,
    toggleSidebar,
    setMobileMenuOpen,
  } = usePortfolioStore();

  // Aggregate dynamic totals across businesses
  const totals = useMemo(() => calculatePortfolioTotals(businesses), [businesses]);

  // Current active branch drill-down if any
  const currentBranch = useMemo(() => {
    if (drillDownBranchId) {
      return travkingsBranches.find((b) => b.id === drillDownBranchId) ?? null;
    }
    if (selectedBranchId !== 'all') {
      return travkingsBranches.find((b) => b.id === selectedBranchId) ?? null;
    }
    return null;
  }, [drillDownBranchId, selectedBranchId, travkingsBranches]);

  const currentBusiness = useMemo(() => {
    if (drillDownBusinessId) {
      return businesses.find((b) => b.id === drillDownBusinessId) ?? null;
    }
    if (selectedBusinessId !== 'all') {
      return businesses.find((b) => b.id === selectedBusinessId) ?? null;
    }
    return null;
  }, [drillDownBusinessId, selectedBusinessId, businesses]);

  function handleBranchClick(branchId: string) {
    drillDownToBranch(branchId);
  }

  function handleBusinessClick(bizId: string) {
    if (bizId === 'biz-travkings') {
      setActiveTab('travkings');
    } else {
      drillDownToBusiness(bizId);
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 1. Minimal Collapsible Sidebar */}
      <OwnerSidebar
        businesses={businesses}
        travkingsBranches={travkingsBranches}
        activeTab={activeTab}
        selectedBusinessId={selectedBusinessId}
        selectedBranchId={selectedBranchId}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onSelectTab={setActiveTab}
        onSelectBusiness={(id) => {
          setSelectedBusinessId(id);
          if (id === 'biz-travkings') {
            setActiveTab('travkings');
          } else {
            setActiveTab('businesses');
          }
        }}
        onSelectBranch={(id) => {
          setSelectedBranchId(id);
          drillDownToBranch(id);
        }}
        onToggleCollapse={toggleSidebar}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* 2. Main Executive Canvas */}
      <main className={styles.mainCanvas}>
        <div className={styles.dashboardContent}>
          {/* Executive Header with Greeting, Time Period, and Global Filters */}
          <OwnerHeader
            businesses={businesses}
            branches={travkingsBranches}
            dateFilter={dateFilter}
            selectedBusinessId={selectedBusinessId}
            selectedBranchId={selectedBranchId}
            onDateFilterChange={setDateFilter}
            onBusinessChange={setSelectedBusinessId}
            onBranchChange={setSelectedBranchId}
            onToggleMobileMenu={() => setMobileMenuOpen(true)}
            onOpenNewCompanyModal={onOpenNewCompanyModal}
          />

          {/* Hierarchical Breadcrumbs (Progressive Disclosure) */}
          <OwnerBreadcrumbs
            activeTab={activeTab}
            selectedBusinessName={currentBusiness?.name}
            selectedBranchName={currentBranch?.name}
            onNavigate={setActiveTab}
            onClearBranch={resetDrillDown}
          />

          {/* View Routing Based on activeTab */}

          {/* TAB 1: EXECUTIVE OVERVIEW (Full Layout as per Requirement 24) */}
          {activeTab === 'overview' && (
            <>
              {/* 1. Top Executive KPI Cards */}
              <KpiCards totals={totals} />

              {/* 2. Portfolio Performance Comparison Chart */}
              <div className={styles.cardBox}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>Portfolio Performance</h3>
                  <button
                    type="button"
                    className={styles.viewAllLink}
                    onClick={() => setActiveTab('performance')}
                  >
                    Detailed Analytics <ArrowRight size={12} />
                  </button>
                </div>
                <BusinessPerformanceChart
                  businesses={businesses}
                  onSelectBusiness={handleBusinessClick}
                />
              </div>

              {/* 3. Two Column Row: Business Portfolio Summary & Investment Allocation */}
              <div className={styles.twoColRow}>
                {/* Business Portfolio Cards */}
                <div className={styles.cardBox}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>Business Portfolio (5 Major Holdings)</h3>
                    <button
                      type="button"
                      className={styles.viewAllLink}
                      onClick={() => setActiveTab('businesses')}
                    >
                      View Table <ArrowRight size={12} />
                    </button>
                  </div>
                  <BusinessPortfolioSection
                    businesses={businesses}
                    onSelectBusiness={handleBusinessClick}
                  />
                </div>

                {/* Investment Allocation Donut & Capital Return */}
                <div className={styles.cardBox}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>Investment Allocation</h3>
                    <button
                      type="button"
                      className={styles.viewAllLink}
                      onClick={() => setActiveTab('investments')}
                    >
                      Capital Schedule <ArrowRight size={12} />
                    </button>
                  </div>
                  <InvestmentAllocationDonut
                    businesses={businesses}
                    totalInvestment={totals.totalInvestment}
                    currentValue={totals.currentValue}
                  />
                </div>
              </div>

              {/* 4. Two Column Row: Travkings Branch Performance & Revenue vs Expenses vs Profit */}
              <div className={styles.twoColRow}>
                {/* Travkings Branch Comparison Bar Chart */}
                <div className={styles.cardBox}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>Travkings Branch Performance</h3>
                    <button
                      type="button"
                      className={styles.viewAllLink}
                      onClick={() => setActiveTab('travkings')}
                    >
                      Branch Analytics <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Compact quick branch chips */}
                  <div className={styles.compactBranchStrip}>
                    {travkingsBranches.map((br) => {
                      const isProfit = br.profit >= 0;
                      return (
                        <div
                          key={br.id}
                          className={styles.branchChip}
                          onClick={() => handleBranchClick(br.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleBranchClick(br.id)}
                        >
                          <div className={styles.chipHeader}>
                            <span>{br.name}</span>
                            <span
                              style={{
                                color: isProfit ? 'var(--success-fg)' : 'var(--danger-fg)',
                              }}
                            >
                              {isProfit ? '🟢' : '🔴'}
                            </span>
                          </div>
                          <span
                            className={styles.chipProfit}
                            style={{
                              color: isProfit ? 'var(--success-fg)' : 'var(--danger-fg)',
                            }}
                          >
                            {formatCrLakh(br.profit, { forceSign: true })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <BranchComparisonChart
                    branches={travkingsBranches}
                    onSelectBranch={handleBranchClick}
                  />
                </div>

                {/* Combined Financial Performance */}
                <div className={styles.cardBox}>
                  <div className={styles.cardHead}>
                    <h3 className={styles.cardTitle}>Revenue vs Expenses vs Profit</h3>
                    <button
                      type="button"
                      className={styles.viewAllLink}
                      onClick={() => setActiveTab('performance')}
                    >
                      Growth Trends <ArrowRight size={12} />
                    </button>
                  </div>
                  <FinancialPerformanceCombinedChart data={portfolioMonthlyData} />
                </div>
              </div>

              {/* 5. Partner Profit Distribution Donut */}
              <div className={styles.cardBox}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>Partner Profit Distribution (25% Split)</h3>
                  <button
                    type="button"
                    className={styles.viewAllLink}
                    onClick={() => setActiveTab('partners')}
                  >
                    Partner Matrix <ArrowRight size={12} />
                  </button>
                </div>
                <PartnerShareDonut
                  businesses={businesses}
                  selectedBusinessId={selectedBusinessId}
                  onSelectBusiness={setSelectedBusinessId}
                />
              </div>

              {/* 6. Dynamic Business Insights */}
              <BusinessInsightsSection
                businesses={businesses}
                branches={travkingsBranches}
              />

              {/* 7. Recent Financial Activity Summary */}
              <div className={styles.cardBox}>
                <div className={styles.cardHead}>
                  <h3 className={styles.cardTitle}>Recent Financial Activity</h3>
                  <button
                    type="button"
                    className={styles.viewAllLink}
                    onClick={() => setActiveTab('transactions')}
                  >
                    All Transactions <ArrowRight size={12} />
                  </button>
                </div>
                <TransactionsSection transactions={transactions.slice(0, 5)} />
              </div>
            </>
          )}

          {/* TAB 2: BUSINESSES */}
          {activeTab === 'businesses' && (
            <BusinessPortfolioSection
              businesses={businesses}
              onSelectBusiness={handleBusinessClick}
            />
          )}

          {/* TAB 3: TRAVKINGS BRANCHES */}
          {activeTab === 'travkings' && (
            <TravkingsBranchSection
              branches={travkingsBranches}
              onSelectBranch={handleBranchClick}
            />
          )}

          {/* TAB 4: BRANCH DRILL-DOWN */}
          {activeTab === 'branch-detail' && currentBranch && (
            <BranchDrillDownView
              branch={currentBranch}
              allBranches={travkingsBranches}
              onBack={() => setActiveTab('travkings')}
              onSelectOtherBranch={drillDownToBranch}
            />
          )}

          {/* TAB 5: INVESTMENTS */}
          {activeTab === 'investments' && (
            <InvestmentOverviewSection
              businesses={businesses}
              totals={totals}
            />
          )}

          {/* TAB 6: PERFORMANCE */}
          {activeTab === 'performance' && (
            <PerformanceSection
              businesses={businesses}
              branches={travkingsBranches}
              portfolioMonthlyData={portfolioMonthlyData}
              onSelectBusiness={handleBusinessClick}
              onSelectBranch={handleBranchClick}
            />
          )}

          {/* TAB 7: PARTNERS */}
          {activeTab === 'partners' && (
            <PartnerDistributionSection
              businesses={businesses}
              selectedBusinessId={selectedBusinessId}
              onSelectBusiness={setSelectedBusinessId}
            />
          )}

          {/* TAB 8: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <TransactionsSection transactions={transactions} />
          )}

          {/* TAB 9: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsSection
              businesses={businesses}
              branches={travkingsBranches}
            />
          )}

          {/* TAB 10: ACCOUNTING BOOKS & SYSTEM MASTERS */}
          {activeTab === 'accounting-books' && (
            <div className={styles.cardBox}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>System Masters &amp; Accounting Books</h3>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  Chart of accounts, journals, and voucher ledgers
                </span>
              </div>
              {renderAccountingBooks ? renderAccountingBooks() : null}
            </div>
          )}
        </div>
      </main>

      {/* 3. Executive Mobile Floating Navigation Bar */}
      <nav className={styles.mobileBottomBar} aria-label="Quick mobile navigation">
        <button
          type="button"
          className={`${styles.mobileBottomItem} ${activeTab === 'overview' ? styles.mobileBottomItemActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${activeTab === 'businesses' ? styles.mobileBottomItemActive : ''}`}
          onClick={() => {
            setSelectedBusinessId('all');
            setActiveTab('businesses');
          }}
        >
          <Building2 size={18} />
          <span>Businesses</span>
        </button>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${activeTab === 'travkings' || activeTab === 'branch-detail' ? styles.mobileBottomItemActive : ''}`}
          onClick={() => setActiveTab('travkings')}
        >
          <MapPin size={18} />
          <span>Hubs</span>
        </button>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${activeTab === 'partners' ? styles.mobileBottomItemActive : ''}`}
          onClick={() => setActiveTab('partners')}
        >
          <Users size={18} />
          <span>Partners</span>
        </button>

        <button
          type="button"
          className={`${styles.mobileBottomItem} ${styles.mobileBottomMenuBtn}`}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open full sidebar navigation drawer"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
