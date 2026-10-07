export type FinancialStatus = 'STRONG' | 'GOOD' | 'LOSS';

export interface Partner {
  id: string;
  name: string;
  businessId: string;
  sharePercentage: number; // e.g. 25
  profitShare: number; // calculated: totalProfit * (sharePercentage / 100)
}

export interface MonthlyDataPoint {
  month: string; // e.g. 'Jan', 'Feb'
  revenue: number;
  expenses: number;
  profit: number;
  investment?: number;
}

export interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

export interface InvestmentMilestone {
  date: string;
  title: string;
  amount: number;
  description: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string; // MHUB, BOM, DAR, FBM, NBO
  code: string;
  investment: number;
  revenue: number;
  expenses: number;
  profit: number;
  roi: number; // in percentage, e.g. 50%
  profitMargin: number; // in percentage
  growthPercent: number;
  status: FinancialStatus;
  partners: Partner[];
  monthlyRevenue: Array<{ month: string; amount: number }>;
  monthlyProfit: Array<{ month: string; amount: number }>;
  investmentHistory: InvestmentMilestone[];
  expenseBreakdown: ExpenseCategory[];
}

export interface Business {
  id: string;
  name: string;
  shortName: string;
  code: string;
  investment: number;
  revenue: number;
  expenses: number;
  currentValue: number;
  profit: number;
  roi: number;
  branchesCount: number;
  partnersCount: number;
  sparkline: number[];
  status: FinancialStatus;
  partners: Partner[];
  branches?: Branch[];
  monthlyData: MonthlyDataPoint[];
  allocationPercent: number; // e.g. 41%
  initialInvestment: number;
  additionalInvestment: number;
}

export type TransactionType =
  | 'Investment'
  | 'Revenue'
  | 'Expense'
  | 'Profit'
  | 'Withdrawal'
  | 'Partner Distribution';

export interface FinancialTransaction {
  id: string;
  date: string;
  business: string;
  businessId: string;
  branch?: string;
  type: TransactionType;
  amount: number;
  category: string;
  status: 'Completed' | 'Pending' | 'Scheduled';
}

export interface PortfolioTotals {
  totalInvestment: number;
  investmentChangePercent: number;
  currentValue: number;
  valueGrowthPercent: number;
  totalProfit: number;
  profitRoiPercent: number;
  totalRevenue: number;
  totalExpenses: number;
  ownerShare: number; // 25% of total portfolio profit
  initialInvestmentTotal: number;
  additionalInvestmentTotal: number;
  totalReturn: number;
}

export interface BusinessInsight {
  id: string;
  type: 'positive' | 'warning' | 'info';
  title: string;
  text: string;
}

export type DateRangeFilter =
  | 'This Month'
  | 'Last Month'
  | 'Quarter'
  | 'YTD'
  | 'This Year'
  | 'Last Year'
  | 'Custom';

export type MetricType = 'Revenue' | 'Profit' | 'Investment' | 'Expenses' | 'ROI';

export type TimeRangeFilter = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'ALL';

export type OwnerDashboardTab =
  | 'overview'
  | 'businesses'
  | 'travkings'
  | 'branch-detail'
  | 'investments'
  | 'performance'
  | 'partners'
  | 'transactions'
  | 'reports'
  | 'accounting-books'
  | 'company'
  | 'masters';
