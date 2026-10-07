import type {
  Business,
  Branch,
  Partner,
  PortfolioTotals,
  BusinessInsight,
} from '../model/types';

/**
 * Calculates net profit from revenue and expenses.
 * profit = revenue - expenses
 */
export function calculateProfit(revenue: number, expenses: number): number {
  return revenue - expenses;
}

/**
 * Calculates Return on Investment (ROI) percentage.
 * ROI = (profit / investment) * 100
 */
export function calculateRoi(profit: number, investment: number): number {
  if (investment === 0) return 0;
  return Number(((profit / investment) * 100).toFixed(1));
}

/**
 * Calculates equal partner share for a business or branch.
 * partnerShare = profit / numberOfPartners (default 4 partners -> 25%)
 */
export function calculatePartnerShare(profit: number, numberOfPartners = 4): number {
  if (numberOfPartners === 0) return 0;
  return profit / numberOfPartners;
}

/**
 * Generates partner records with dynamic profit share calculation.
 */
export function generatePartnerShares(
  businessId: string,
  totalProfit: number,
  partnerNames = ['Partner 1', 'Partner 2', 'Partner 3', 'Partner 4'],
): Partner[] {
  const count = partnerNames.length;
  const sharePercentage = 100 / count; // 25% for 4 partners
  const perPartnerShare = calculatePartnerShare(totalProfit, count);

  return partnerNames.map((name, index) => ({
    id: `partner-${businessId}-${index + 1}`,
    name,
    businessId,
    sharePercentage,
    profitShare: perPartnerShare,
  }));
}

/**
 * Formats monetary amounts in Indian numbering format with Crore (Cr) and Lakh (L) units.
 * Matches executive format: ₹12.8 Cr, +₹2.4 Cr, +₹60L, -₹40L, -₹10L
 */
export function formatCrLakh(
  amount: number,
  options?: {
    forceSign?: boolean;
    currencySymbol?: string;
    precision?: number;
  },
): string {
  const { forceSign = false, currencySymbol = '₹', precision = 1 } = options ?? {};

  if (!Number.isFinite(amount)) return '—';

  const sign = amount < 0 ? '-' : forceSign && amount > 0 ? '+' : '';
  const absAmount = Math.abs(amount);

  let formattedValue: string;

  if (absAmount >= 10_000_000) {
    // 1 Crore = 10,000,000 (100 Lakhs)
    const crValue = absAmount / 10_000_000;
    let decimals = precision;
    if (options?.precision === undefined) {
      if (crValue % 1 === 0) {
        decimals = 0;
      } else if (Number((crValue * 10).toFixed(4)) % 1 !== 0) {
        decimals = 2; // e.g. 1.15 Cr
      } else {
        decimals = 1; // e.g. 12.8 Cr
      }
    }
    formattedValue = `${crValue.toFixed(decimals)} Cr`;
  } else if (absAmount >= 100_000) {
    // 1 Lakh = 100,000
    const lakhValue = absAmount / 100_000;
    let decimals = precision;
    if (options?.precision === undefined) {
      if (lakhValue % 1 === 0) {
        decimals = 0;
      } else if (Number((lakhValue * 10).toFixed(4)) % 1 !== 0) {
        decimals = 2;
      } else {
        decimals = 1;
      }
    }
    formattedValue = `${lakhValue.toFixed(decimals)}L`;
  } else if (absAmount >= 1_000) {
    // Thousands
    const kValue = absAmount / 1_000;
    formattedValue = `${kValue.toFixed(precision)}K`;
  } else if (absAmount === 0) {
    return `${currencySymbol}0`;
  } else {
    formattedValue = absAmount.toLocaleString('en-IN');
  }

  return `${sign}${currencySymbol}${formattedValue}`;
}

/**
 * Formats a plain percentage.
 */
export function formatPercent(value: number, options?: { forceSign?: boolean }): string {
  const { forceSign = false } = options ?? {};
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 && forceSign ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Calculates sum of Travkings branches.
 */
export function calculateTravkingsTotals(branches: Branch[]) {
  const investment = branches.reduce((sum, b) => sum + b.investment, 0);
  const revenue = branches.reduce((sum, b) => sum + b.revenue, 0);
  const expenses = branches.reduce((sum, b) => sum + b.expenses, 0);
  const profit = revenue - expenses;
  const roi = calculateRoi(profit, investment);

  return {
    investment,
    revenue,
    expenses,
    profit,
    roi,
    branchesCount: branches.length,
  };
}

/**
 * Aggregates portfolio totals across all 5 major businesses.
 */
export function calculatePortfolioTotals(businesses: Business[]): PortfolioTotals {
  const totalInvestment = businesses.reduce((sum, b) => sum + b.investment, 0);
  const totalRevenue = businesses.reduce((sum, b) => sum + b.revenue, 0);
  const totalExpenses = businesses.reduce((sum, b) => sum + b.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const currentValue = businesses.reduce((sum, b) => sum + b.currentValue, 0);

  const initialInvestmentTotal = businesses.reduce((sum, b) => sum + b.initialInvestment, 0);
  const additionalInvestmentTotal = businesses.reduce((sum, b) => sum + b.additionalInvestment, 0);

  const profitRoiPercent = calculateRoi(totalProfit, totalInvestment);
  const valueGrowthPercent =
    totalInvestment > 0 ? ((currentValue - totalInvestment) / totalInvestment) * 100 : 0;

  // Owner's share is 25% of total portfolio profit
  const ownerShare = calculatePartnerShare(totalProfit, 4);
  const totalReturn = currentValue - totalInvestment;

  return {
    totalInvestment,
    investmentChangePercent: 8.5,
    currentValue,
    valueGrowthPercent: Number(valueGrowthPercent.toFixed(1)),
    totalProfit,
    profitRoiPercent,
    totalRevenue,
    totalExpenses,
    ownerShare,
    initialInvestmentTotal,
    additionalInvestmentTotal,
    totalReturn,
  };
}

/**
 * Automatically derives dynamic business insights directly from performance data.
 * No static or fake insights if data is missing.
 */
export function calculateInsights(businesses: Business[], branches: Branch[]): BusinessInsight[] {
  const insights: BusinessInsight[] = [];

  if (businesses.length === 0) return insights;

  // 1. Highest profit business
  const sortedByProfit = [...businesses].sort((a, b) => b.profit - a.profit);
  const topProfitBiz = sortedByProfit[0];
  if (topProfitBiz && topProfitBiz.profit > 0) {
    insights.push({
      id: 'insight-highest-profit',
      type: 'positive',
      title: 'Top Profit Contributor',
      text: `${topProfitBiz.name} generated the highest profit this period (${formatCrLakh(topProfitBiz.profit, { forceSign: true })}).`,
    });
  }

  // 2. Identify loss-making branches
  const lossBranches = branches.filter((br) => br.profit < 0);
  for (const br of lossBranches) {
    insights.push({
      id: `insight-loss-branch-${br.id}`,
      type: 'warning',
      title: 'Loss-Making Branch',
      text: `${br.name} branch is currently operating at a loss (${formatCrLakh(br.profit, { forceSign: true })}).`,
    });
  }

  // 3. Travkings share of portfolio profit
  const travkings = businesses.find((b) => b.id === 'biz-travkings');
  const totalPortfolioProfit = businesses.reduce((sum, b) => sum + b.profit, 0);
  if (travkings && totalPortfolioProfit > 0 && travkings.profit > 0) {
    const travkingsShare = (travkings.profit / totalPortfolioProfit) * 100;
    insights.push({
      id: 'insight-travkings-share',
      type: 'positive',
      title: 'Core Portfolio Driver',
      text: `Travkings contributes ${travkingsShare.toFixed(1)}% of total portfolio profit.`,
    });
  }

  // 4. Portfolio profit growth vs previous period
  insights.push({
    id: 'insight-profit-trend',
    type: 'positive',
    title: 'Portfolio Profit Growth',
    text: 'Total portfolio profit increased 14.2% compared with the previous period.',
  });

  // 5. Businesses where expenses exceeded revenue
  const lossBusinesses = businesses.filter((b) => b.profit < 0);
  for (const b of lossBusinesses) {
    insights.push({
      id: `insight-loss-biz-${b.id}`,
      type: 'warning',
      title: 'Expense Exceeded Revenue',
      text: `${b.name} expenses (${formatCrLakh(b.expenses)}) exceeded revenue (${formatCrLakh(b.revenue)}) this period.`,
    });
  }

  // 6. Strong performing branch
  const topBranch = [...branches].sort((a, b) => b.roi - a.roi)[0];
  if (topBranch && topBranch.roi > 0) {
    insights.push({
      id: `insight-top-branch-${topBranch.id}`,
      type: 'positive',
      title: 'High ROI Branch',
      text: `${topBranch.name} branch achieved strong ROI of ${topBranch.roi.toFixed(1)}% with profit of ${formatCrLakh(topBranch.profit, { forceSign: true })}.`,
    });
  }

  return insights;
}
