import { Printer, Menu, Building2, Sun, Moon } from 'lucide-react';
import type {
  Business,
  Branch,
  DateRangeFilter,
} from '@/entities/owner-portfolio';
import { triggerExecutivePrint } from '@/entities/owner-portfolio';
import { useTheme, setTheme } from '@/shared/hooks';
import styles from './OwnerHeader.module.css';

interface OwnerHeaderProps {
  businesses: Business[];
  branches: Branch[];
  dateFilter: DateRangeFilter;
  selectedBusinessId: string | 'all';
  selectedBranchId: string | 'all';
  onDateFilterChange: (filter: DateRangeFilter) => void;
  onBusinessChange: (id: string | 'all') => void;
  onBranchChange: (id: string | 'all') => void;
  onToggleMobileMenu: () => void;
  onOpenNewCompanyModal?: () => void;
}

export function OwnerHeader({
  businesses,
  branches,
  dateFilter,
  selectedBusinessId,
  selectedBranchId,
  onDateFilterChange,
  onBusinessChange,
  onBranchChange,
  onToggleMobileMenu,
  onOpenNewCompanyModal,
}: OwnerHeaderProps) {
  const theme = useTheme();
  const isTravkingsSelected =
    selectedBusinessId === 'biz-travkings' || selectedBusinessId === 'all';

  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  function handleToggleTheme() {
    if (isDarkMode) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.greetingGroup}>
          <div className={styles.greetingRow}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={onToggleMobileMenu}
              aria-label="Toggle navigation menu"
              title="Open Navigation Menu"
            >
              <Menu size={18} />
              <span className={styles.mobileMenuText}>Menu</span>
            </button>
            <h1 className={styles.greeting}>Good Morning, Owner</h1>
            <span className={styles.statusPill}>
              <span className={styles.statusDot} /> Portfolio Active
            </span>
          </div>
          <div className={styles.dateSub}>
            <span>Portfolio Overview</span>
            <span>·</span>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>October 2026</span>
            <span>·</span>
            <span>All 5 Entities Synchronized</span>
          </div>
        </div>

        <div className={styles.actionsGroup}>
          <button
            type="button"
            className={styles.themeToggleBtn}
            onClick={handleToggleTheme}
            title={isDarkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <Sun size={14} className={styles.themeSun} />
            ) : (
              <Moon size={14} className={styles.themeMoon} />
            )}
            <span>{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={triggerExecutivePrint}
            title="Print or Save as PDF"
          >
            <Printer size={13} /> Export PDF
          </button>
          {onOpenNewCompanyModal && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={onOpenNewCompanyModal}
            >
              <Building2 size={13} /> New Company
            </button>
          )}
        </div>
      </div>

      {/* Global Filter Controls */}
      <div className={styles.filtersBar}>
        {/* 1. Date Range Filter */}
        <div className={styles.filterItem}>
          <label htmlFor="filter-date" className={styles.filterLabel}>
            Period:
          </label>
          <select
            id="filter-date"
            className={styles.select}
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value as DateRangeFilter)}
          >
            <option value="This Month">This Month (Oct 2026)</option>
            <option value="Last Month">Last Month (Sep 2026)</option>
            <option value="Quarter">Q3 2026</option>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="This Year">This Year (FY 2026-27)</option>
            <option value="Last Year">Last Year (FY 2025-26)</option>
            <option value="Custom">Custom Range</option>
          </select>
        </div>

        {/* 2. Business Filter */}
        <div className={styles.filterItem}>
          <label htmlFor="filter-business" className={styles.filterLabel}>
            Business:
          </label>
          <select
            id="filter-business"
            className={styles.select}
            value={selectedBusinessId}
            onChange={(e) => onBusinessChange(e.target.value)}
          >
            <option value="all">All 5 Businesses</option>
            {businesses.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Branch Filter for Travkings */}
        {isTravkingsSelected && (
          <div className={styles.filterItem}>
            <label htmlFor="filter-branch" className={styles.filterLabel}>
              Travkings Branch:
            </label>
            <select
              id="filter-branch"
              className={styles.select}
              value={selectedBranchId}
              onChange={(e) => onBranchChange(e.target.value)}
            >
              <option value="all">All Regional Branches</option>
              {branches.map((br) => (
                <option key={br.id} value={br.id}>
                  {br.name} Hub
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
