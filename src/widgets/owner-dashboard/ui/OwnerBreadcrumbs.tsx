import { ChevronRight, Home } from 'lucide-react';
import type { OwnerDashboardTab } from '@/entities/owner-portfolio';
import styles from './OwnerBreadcrumbs.module.css';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface OwnerBreadcrumbsProps {
  activeTab: OwnerDashboardTab;
  selectedBusinessName?: string;
  selectedBranchName?: string;
  onNavigate: (tab: OwnerDashboardTab) => void;
  onClearBranch?: () => void;
}

export function OwnerBreadcrumbs({
  activeTab,
  selectedBusinessName,
  selectedBranchName,
  onNavigate,
  onClearBranch,
}: OwnerBreadcrumbsProps) {
  const items: BreadcrumbItem[] = [
    {
      label: 'Overview',
      onClick: () => onNavigate('overview'),
      active: activeTab === 'overview',
    },
  ];

  if (activeTab === 'businesses') {
    items.push({
      label: 'Businesses',
      active: !selectedBusinessName,
      onClick: () => onNavigate('businesses'),
    });
    if (selectedBusinessName) {
      items.push({ label: selectedBusinessName, active: true });
    }
  } else if (activeTab === 'travkings') {
    items.push({
      label: 'Travkings Tour and Travels',
      active: true,
      onClick: () => onNavigate('travkings'),
    });
  } else if (activeTab === 'branch-detail') {
    items.push({
      label: 'Travkings',
      onClick: () => {
        onClearBranch?.();
        onNavigate('travkings');
      },
    });
    if (selectedBranchName) {
      items.push({ label: `${selectedBranchName} Branch`, active: true });
    }
  } else if (activeTab === 'investments') {
    items.push({ label: 'Investments', active: true });
  } else if (activeTab === 'performance') {
    items.push({ label: 'Performance', active: true });
  } else if (activeTab === 'partners') {
    items.push({ label: 'Partner Distribution', active: true });
  } else if (activeTab === 'transactions') {
    items.push({ label: 'Transactions', active: true });
  } else if (activeTab === 'reports') {
    items.push({ label: 'Reports', active: true });
  } else if (activeTab === 'company') {
    items.push({ label: 'Company & Financial Settings', active: true });
  } else if (activeTab === 'masters') {
    items.push({ label: 'Masters & Chart of Accounts', active: true });
  } else if (activeTab === 'accounting-books') {
    items.push({ label: 'System Masters & Accounting Books', active: true });
  }

  if (items.length <= 1) return null;

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumbs">
      {items.map((item, idx) => (
        <span key={item.label} className={styles.item}>
          {idx === 0 && <Home size={12} style={{ marginRight: -2 }} />}
          {item.active || !item.onClick ? (
            <span className={styles.activeItem}>{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={item.onClick}
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
            >
              {item.label}
            </button>
          )}
          {idx < items.length - 1 && <ChevronRight size={12} className={styles.separator} />}
        </span>
      ))}
    </nav>
  );
}
