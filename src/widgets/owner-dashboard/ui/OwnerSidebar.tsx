import { useState } from 'react';
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
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${
          mobileOpen ? styles.sidebarMobileOpen : ''
        }`}
      >
        {/* Brand Header */}
        <div className={styles.brandArea}>
          <div className={styles.brandLink}>
            <div className={styles.brandIconWrapper}>
              <div className={styles.brandIcon}>
                <Sparkles size={15} className={styles.sparkleIcon} />
              </div>
            </div>
            {!collapsed && (
              <div className={styles.brandText}>
                <div className={styles.brandTitleRow}>
                  <span className={styles.brandName}>KBiz360</span>
                  <span className={styles.brandBadge}>OWM</span>
                </div>
                <span className={styles.brandTagline}>Owner Wealth Management</span>
              </div>
            )}
          </div>

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
          {!collapsed && <div className={styles.sectionHeader}>Portfolio Overview</div>}

          {/* 1. Overview */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('overview')}
            title="Executive Overview Dashboard"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <LayoutDashboard size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Overview</span>}
            </div>
          </button>

          {/* 2. Businesses Dropdown Group */}
          <div className={styles.groupContainer}>
            <button
              type="button"
              className={`${styles.navItem} ${activeTab === 'businesses' && selectedBusinessId === 'all' ? styles.navItemActive : ''}`}
              onClick={() => {
                if (collapsed) {
                  onSelectTab('businesses');
                } else {
                  setBusinessesExpanded(!businessesExpanded);
                  onSelectTab('businesses');
                }
              }}
              title="Business Portfolio"
            >
              <div className={styles.navItemLeft}>
                <div className={styles.iconBox}>
                  <Building2 size={17} className={styles.navIcon} />
                </div>
                {!collapsed && <span className={styles.navLabel}>Businesses</span>}
              </div>
              {!collapsed && (
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

            {!collapsed && businessesExpanded && (
              <div className={styles.subNav}>
                <button
                  type="button"
                  className={`${styles.subNavItem} ${activeTab === 'businesses' && selectedBusinessId === 'all' ? styles.subNavItemActive : ''}`}
                  onClick={() => {
                    onSelectTab('businesses');
                  }}
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
                      onClick={() => onSelectBusiness(biz.id)}
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
                if (collapsed) {
                  onSelectTab('travkings');
                } else {
                  setBranchesExpanded(!branchesExpanded);
                  onSelectTab('travkings');
                }
              }}
              title="Travkings Regional Branches"
            >
              <div className={styles.navItemLeft}>
                <div className={styles.iconBox}>
                  <MapPin size={17} className={styles.navIcon} />
                </div>
                {!collapsed && <span className={styles.navLabel}>Travkings Hubs</span>}
              </div>
              {!collapsed && (
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

            {!collapsed && branchesExpanded && (
              <div className={styles.subNav}>
                <button
                  type="button"
                  className={`${styles.subNavItem} ${activeTab === 'travkings' && selectedBranchId === 'all' ? styles.subNavItemActive : ''}`}
                  onClick={() => onSelectTab('travkings')}
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
                      onClick={() => onSelectBranch(br.id)}
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
          {!collapsed && <div className={styles.sectionHeader}>Analytics &amp; Growth</div>}

          {/* 4. Investments */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'investments' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('investments')}
            title="Total Investment Analytics"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <PieChart size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Investments</span>}
            </div>
          </button>

          {/* 5. Performance */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'performance' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('performance')}
            title="Performance Comparison & Heatmap"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <BarChart3 size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Performance</span>}
            </div>
          </button>

          {/* 6. Partners */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'partners' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('partners')}
            title="Partner Profit Distribution (25% Split)"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Users size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Partner Shares</span>}
            </div>
            {!collapsed && <span className={styles.pillTag}>25%</span>}
          </button>

          {/* Section: Books & Accounting */}
          {!collapsed && <div className={styles.sectionHeader}>Records &amp; Audit</div>}

          {/* 7. Transactions */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'transactions' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('transactions')}
            title="Recent Financial Activity"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <Receipt size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Transactions</span>}
            </div>
          </button>

          {/* 8. Reports */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'reports' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('reports')}
            title="Financial Reports & Exports"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <FileSpreadsheet size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Reports &amp; PDF</span>}
            </div>
            {!collapsed && <span className={styles.pillTag}>PDF</span>}
          </button>

          {/* 9. Accounting Books / Masters Gateway */}
          <button
            type="button"
            className={`${styles.navItem} ${activeTab === 'accounting-books' ? styles.navItemActive : ''}`}
            onClick={() => onSelectTab('accounting-books')}
            title="Access Entity Books & System Masters"
          >
            <div className={styles.navItemLeft}>
              <div className={styles.iconBox}>
                <BookOpen size={17} className={styles.navIcon} />
              </div>
              {!collapsed && <span className={styles.navLabel}>Accounting Books</span>}
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
            {!collapsed && (
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
