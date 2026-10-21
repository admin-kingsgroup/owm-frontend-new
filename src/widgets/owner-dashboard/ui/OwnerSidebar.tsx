import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  MapPin,
  PieChart,
  BarChart3,
  Users,
  Receipt,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
  Sliders,
  Layers,
} from 'lucide-react';
import type {
  Business,
  Branch,
  OwnerDashboardTab,
} from '@/entities/owner-portfolio';
import styles from './OwnerSidebar.module.css';

interface OwnerSidebarProps {
  businesses: Business[];
  travkingsBranches: Branch[];
  activeTab: OwnerDashboardTab;
  selectedBusinessId: string | 'all';
  selectedBranchId: string | 'all';
  collapsed: boolean;
  mobileOpen: boolean;
  onSelectTab: (tab: OwnerDashboardTab) => void;
  onSelectBusiness: (bizId: string) => void;
  onSelectBranch: (branchId: string) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

const BUSINESS_DOT_COLORS: Record<string, string> = {
  'biz-travkings': '#1a52c4',
  'biz-quinaliza': '#2f7a72',
  'biz-kings-logistic': '#6b4f9e',
  'biz-hotel-kings': '#b91c1c',
  'biz-techkings': '#d97706',
};

export function OwnerSidebar({
  businesses,
  travkingsBranches,
  activeTab,
  selectedBusinessId,
  selectedBranchId,
  collapsed,
  mobileOpen,
  onSelectTab,
  onSelectBusiness,
  onSelectBranch,
  onToggleCollapse,
  onCloseMobile,
}: OwnerSidebarProps) {
  const [businessesExpanded, setBusinessesExpanded] = useState(true);
  const [branchesExpanded, setBranchesExpanded] = useState(true);

  // On mobile (when drawer is open), always treat as fully expanded so all labels, counts, and items are readable
  const isEffectivelyCollapsed = collapsed && !mobileOpen;

  // Close drawer when Escape key is pressed
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const handleTabClick = (tab: OwnerDashboardTab) => {
    onSelectTab(tab);
    if (mobileOpen) onCloseMobile();
  };

  const handleBusinessClick = (bizId: string) => {
    onSelectBusiness(bizId);
    if (mobileOpen) onCloseMobile();
  };

  const handleBranchClick = (branchId: string) => {
    onSelectBranch(branchId);
    if (mobileOpen) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${isEffectivelyCollapsed ? styles.sidebarCollapsed : ''} ${
          mobileOpen ? styles.sidebarMobileOpen : ''
        }`}
        aria-label="Owner Portfolio Navigation"
      >
        {/* Brand Header */}
        <div className={styles.brandArea}>
          <div className={styles.brandLink}>
            <div className={styles.brandIconWrapper}>
              <div className={styles.brandIcon}>
                <Sparkles size={15} className={styles.sparkleIcon} />
              </div>
            </div>
            {!isEffectivelyCollapsed && (
              <div className={styles.brandText}>
                <div className={styles.brandTitleRow}>
                  <span className={styles.brandName}>KBiz360</span>
                  <span className={styles.brandBadge}>OWM</span>
                </div>
                <span className={styles.brandTagline}>Owner Wealth Management</span>
              </div>
            )}
          </div>

          {/* Dedicated mobile close button */}
          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={onCloseMobile}
            aria-label="Close navigation sidebar"
            title="Close sidebar"
          >
            <X size={18} />
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className={styles.navSection}>
          {/* Section: Overview */}
          {!isEffectivelyCollapsed && <div className={styles.sectionHeader}>Portfolio Overview</div>}

          {/* 1. Overview */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('overview')}
            title="Executive Overview Dashboard"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <LayoutDashboard size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Overview</span>}
            </div>
          </button>

          {/* 2. Businesses Dropdown Group */}
          <div className={styles.groupContainer}>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'businesses' && selectedBusinessId === 'all' ? styles.navItemActive : ''}`}
              onClick={() => {
                if (isEffectivelyCollapsed) {
                  handleTabClick('businesses');
                } else {
                  setBusinessesExpanded(!businessesExpanded);
                  handleTabClick('businesses');
                }
              }}
              title="Business Portfolio"
            >
              <div className={styles.navItemLeft}>
                <div className={styles.iconBox}>
                  <Building2 size={17} className={styles.navIcon} />
                </div>
                {!isEffectivelyCollapsed && <span className={styles.navLabel}>Businesses</span>}
              </div>
              {!isEffectivelyCollapsed && (
                <div className={styles.navItemRight}>
                  <span className={styles.countBadge}>{businesses.length}</span>
                  {businessesExpanded ? (
                    <ChevronDown size={14} className={styles.chevronIcon} />
                  ) : (
                    <ChevronRight size={14} className={styles.chevronIcon} />
                  )}
                </div>
              )}
            </button>

            {!isEffectivelyCollapsed && businessesExpanded && (
              <div className={styles.subNav}>
                <button
                  type="button"
                  className={`${styles.subNavItem} ${activeTab === 'businesses' && selectedBusinessId === 'all' ? styles.subNavItemActive : ''}`}
                  onClick={() => handleTabClick('businesses')}
                >
                  <span className={styles.subDot} style={{ backgroundColor: 'var(--accent)' }} />
                  <span>All Businesses ({businesses.length})</span>
                </button>

                {businesses.map((biz) => {
                  const isActive =
                    (activeTab === 'businesses' || (biz.id === 'biz-travkings' && activeTab === 'travkings')) &&
                    selectedBusinessId === biz.id;
                  const dotColor = BUSINESS_DOT_COLORS[biz.id] || 'var(--sidebar-dim)';

                  return (
                    <button
                      key={biz.id}
                      type="button"
                      className={`${styles.subNavItem} ${isActive ? styles.subNavItemActive : ''}`}
                      onClick={() => handleBusinessClick(biz.id)}
                    >
                      <span className={styles.subDot} style={{ backgroundColor: dotColor }} />
                      <span className={styles.subLabel}>
                        {biz.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Travkings Branches */}
          <div className={styles.groupContainer}>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'travkings' && selectedBranchId === 'all' ? styles.navItemActive : ''}`}
              onClick={() => {
                if (isEffectivelyCollapsed) {
                  handleTabClick('travkings');
                } else {
                  setBranchesExpanded(!branchesExpanded);
                  handleTabClick('travkings');
                }
              }}
              title="Travkings Regional Branches"
            >
              <div className={styles.navItemLeft}>
                <div className={styles.iconBox}>
                  <MapPin size={17} className={styles.navIcon} />
                </div>
                {!isEffectivelyCollapsed && <span className={styles.navLabel}>Travkings Hubs</span>}
              </div>
              {!isEffectivelyCollapsed && (
                <div className={styles.navItemRight}>
                  <span className={styles.countBadge}>{travkingsBranches.length}</span>
                  {branchesExpanded ? (
                    <ChevronDown size={14} className={styles.chevronIcon} />
                  ) : (
                    <ChevronRight size={14} className={styles.chevronIcon} />
                  )}
                </div>
              )}
            </button>

            {!isEffectivelyCollapsed && branchesExpanded && (
              <div className={styles.subNav}>
                <button
                  type="button"
                  className={`${styles.subNavItem} ${activeTab === 'travkings' && selectedBranchId === 'all' ? styles.subNavItemActive : ''}`}
                  onClick={() => handleTabClick('travkings')}
                >
                  <span className={styles.subDot} style={{ backgroundColor: '#1a52c4' }} />
                  <span>All Hubs ({travkingsBranches.length})</span>
                </button>

                {travkingsBranches.map((br) => {
                  const isActive = activeTab === 'branch-detail' && selectedBranchId === br.id;
                  return (
                    <button
                      key={br.id}
                      type="button"
                      className={`${styles.subNavItem} ${isActive ? styles.subNavItemActive : ''}`}
                      onClick={() => handleBranchClick(br.id)}
                    >
                      <span className={styles.subDot} style={{ backgroundColor: '#38bdf8' }} />
                      <span className={styles.subLabel}>{br.name} Hub</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Analytics & Growth */}
          {!isEffectivelyCollapsed && <div className={styles.sectionHeader}>Analytics &amp; Growth</div>}

          {/* 4. Investments */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'investments' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('investments')}
            title="Total Investment Analytics"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <PieChart size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Investments</span>}
            </div>
          </button>

          {/* 5. Performance */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'performance' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('performance')}
            title="Performance Comparison & Heatmap"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <BarChart3 size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Performance</span>}
            </div>
          </button>

          {/* 6. Partners */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'partners' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('partners')}
            title="Partner Profit Distribution (25% Split)"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Users size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Partner Shares</span>}
            </div>
            {!isEffectivelyCollapsed && <span className={styles.pillTag}>25%</span>}
          </button>

          {/* Section: Books & Accounting */}
          {!isEffectivelyCollapsed && <div className={styles.sectionHeader}>Records &amp; Audit</div>}

          {/* 7. Transactions */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'transactions' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('transactions')}
            title="Recent Financial Activity"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Receipt size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Transactions</span>}
            </div>
          </button>

          {/* 8. Reports */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'reports' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('reports')}
            title="Financial Reports & Exports"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <FileSpreadsheet size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Reports &amp; PDF</span>}
            </div>
            {!isEffectivelyCollapsed && <span className={styles.pillTag}>PDF</span>}
          </button>

          {/* 9. Company & Legal Entities */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'company' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('company')}
            title="Legal Entity & Financial Years"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Sliders size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Company Setup</span>}
            </div>
          </button>

          {/* 10. Masters & Ledgers */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'masters' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('masters')}
            title="Chart of Accounts, Counter-Parties & Vouchers"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Layers size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Masters &amp; Accounts</span>}
            </div>
          </button>

          {/* 11. Accounting Books / Masters Gateway */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'accounting-books' ? styles.navItemActive : ''}`}
            onClick={() => handleTabClick('accounting-books')}
            title="Access Entity Books & System Masters"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <BookOpen size={17} className={styles.navIcon} />
              </div>
              {!isEffectivelyCollapsed && <span className={styles.navLabel}>Accounting Books</span>}
            </div>
          </button>
        </nav>

        {/* Footer Profile */}
        <div className={styles.footerArea}>
          <div className={styles.ownerProfile}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>OW</div>
              <span className={styles.statusDot} title="Online / Active" />
            </div>
            {!isEffectivelyCollapsed && (
              <div className={styles.profileInfo}>
                <span className={styles.profileName}>Managing Owner</span>
                <span className={styles.profileRole}>Primary Stakeholder</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
