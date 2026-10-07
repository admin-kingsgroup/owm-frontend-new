import { create } from 'zustand';
import type {
  Business,
  Branch,
  FinancialTransaction,
  DateRangeFilter,
  OwnerDashboardTab,
} from './types';
import {
  initialBusinesses,
  initialTravkingsBranches,
  initialTransactions,
} from './mock-data';

interface PortfolioStoreState {
  businesses: Business[];
  travkingsBranches: Branch[];
  transactions: FinancialTransaction[];
  dateFilter: DateRangeFilter;
  selectedBusinessId: string | 'all';
  selectedBranchId: string | 'all';
  activeTab: OwnerDashboardTab;
  drillDownBranchId: string | null;
  drillDownBusinessId: string | null;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;

  // Actions
  setDateFilter: (filter: DateRangeFilter) => void;
  setSelectedBusinessId: (id: string | 'all') => void;
  setSelectedBranchId: (id: string | 'all') => void;
  setActiveTab: (tab: OwnerDashboardTab) => void;
  drillDownToBranch: (branchId: string) => void;
  drillDownToBusiness: (businessId: string) => void;
  resetDrillDown: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const usePortfolioStore = create<PortfolioStoreState>((set) => ({
  businesses: initialBusinesses,
  travkingsBranches: initialTravkingsBranches,
  transactions: initialTransactions,
  dateFilter: 'This Month',
  selectedBusinessId: 'all',
  selectedBranchId: 'all',
  activeTab: 'overview',
  drillDownBranchId: null,
  drillDownBusinessId: null,
  sidebarCollapsed: false,
  mobileMenuOpen: false,

  setDateFilter: (dateFilter) => set({ dateFilter }),

  setSelectedBusinessId: (selectedBusinessId) =>
    set({
      selectedBusinessId,
      // If a business other than Travkings is selected, reset branch filter
      selectedBranchId: selectedBusinessId === 'biz-travkings' ? 'all' : 'all',
    }),

  setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),

  setActiveTab: (activeTab) =>
    set((state) => {
      // Clear drilldown if switching tabs away from branch-detail
      const patch: Partial<PortfolioStoreState> = { activeTab, mobileMenuOpen: false };
      if (activeTab !== 'branch-detail') {
        patch.drillDownBranchId = null;
      }
      return { ...state, ...patch };
    }),

  drillDownToBranch: (branchId) =>
    set({
      drillDownBranchId: branchId,
      activeTab: 'branch-detail',
      mobileMenuOpen: false,
    }),

  drillDownToBusiness: (businessId) =>
    set({
      drillDownBusinessId: businessId,
      selectedBusinessId: businessId,
      activeTab: businessId === 'biz-travkings' ? 'travkings' : 'businesses',
      mobileMenuOpen: false,
    }),

  resetDrillDown: () =>
    set({
      drillDownBranchId: null,
      drillDownBusinessId: null,
      activeTab: 'overview',
    }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
}));
