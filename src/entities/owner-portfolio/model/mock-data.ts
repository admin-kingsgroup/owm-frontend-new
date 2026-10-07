import type { Business, Branch, FinancialTransaction, MonthlyDataPoint } from './types';
import { generatePartnerShares } from '../lib/calculations';

// 1. Travkings Branches
export const initialTravkingsBranches: Branch[] = [
  {
    id: 'branch-mhub',
    businessId: 'biz-travkings',
    name: 'MHUB',
    code: 'MHUB',
    investment: 12_000_000, // ₹1.2 Cr
    revenue: 34_000_000, // ₹3.4 Cr
    expenses: 28_000_000, // ₹2.8 Cr
    profit: 6_000_000, // +₹60L
    roi: 50.0,
    profitMargin: 17.6,
    growthPercent: 18.4,
    status: 'STRONG',
    partners: generatePartnerShares('branch-mhub', 6_000_000),
    monthlyRevenue: [
      { month: 'Jan', amount: 4_800_000 },
      { month: 'Feb', amount: 5_200_000 },
      { month: 'Mar', amount: 5_600_000 },
      { month: 'Apr', amount: 5_800_000 },
      { month: 'May', amount: 6_200_000 },
      { month: 'Jun', amount: 6_400_000 },
    ],
    monthlyProfit: [
      { month: 'Jan', amount: 800_000 },
      { month: 'Feb', amount: 900_000 },
      { month: 'Mar', amount: 1_000_000 },
      { month: 'Apr', amount: 1_000_000 },
      { month: 'May', amount: 1_100_000 },
      { month: 'Jun', amount: 1_200_000 },
    ],
    investmentHistory: [
      {
        date: '15 Jan 2024',
        title: 'Initial Hub Infrastructure & Fleet',
        amount: 7_000_000,
        description: 'Commercial fleet acquisition, terminal depot setup, and licensing.',
      },
      {
        date: '20 Aug 2024',
        title: 'Vehicle Fleet Expansion Phase 2',
        amount: 3_000_000,
        description: 'Added 6 luxury touring buses and premium SUV transfer vehicles.',
      },
      {
        date: '10 Mar 2025',
        title: 'Digital Dispatch & GPS Tracking Tech',
        amount: 2_000_000,
        description: 'Integrated fleet telemetry, automated booking engine, and ERP connector.',
      },
    ],
    expenseBreakdown: [
      { category: 'Transport & Fleet Fuel', amount: 11_200_000, percentage: 40, color: '#1a52c4' },
      { category: 'Salaries & Crews', amount: 8_400_000, percentage: 30, color: '#2f7a72' },
      { category: 'Terminal Operations', amount: 4_200_000, percentage: 15, color: '#b0663a' },
      { category: 'Marketing & Corporate Tie-ups', amount: 2_800_000, percentage: 10, color: '#6b4f9e' },
      { category: 'Compliance, Insurance & Other', amount: 1_400_000, percentage: 5, color: '#9a7b28' },
    ],
  },
  {
    id: 'branch-bom',
    businessId: 'biz-travkings',
    name: 'BOM',
    code: 'BOM',
    investment: 9_000_000, // ₹90L
    revenue: 27_000_000, // ₹2.7 Cr
    expenses: 23_000_000, // ₹2.3 Cr
    profit: 4_000_000, // +₹40L
    roi: 44.4,
    profitMargin: 14.8,
    growthPercent: 12.1,
    status: 'GOOD',
    partners: generatePartnerShares('branch-bom', 4_000_000),
    monthlyRevenue: [
      { month: 'Jan', amount: 4_000_000 },
      { month: 'Feb', amount: 4_200_000 },
      { month: 'Mar', amount: 4_500_000 },
      { month: 'Apr', amount: 4_600_000 },
      { month: 'May', amount: 4_800_000 },
      { month: 'Jun', amount: 4_900_000 },
    ],
    monthlyProfit: [
      { month: 'Jan', amount: 550_000 },
      { month: 'Feb', amount: 600_000 },
      { month: 'Mar', amount: 650_000 },
      { month: 'Apr', amount: 700_000 },
      { month: 'May', amount: 750_000 },
      { month: 'Jun', amount: 750_000 },
    ],
    investmentHistory: [
      {
        date: '10 Feb 2024',
        title: 'Mumbai City Office & Fleet Setup',
        amount: 6_000_000,
        description: 'Prime commercial office, corporate contract acquisition, and vehicle staging.',
      },
      {
        date: '05 Nov 2024',
        title: 'Airport Transfer Corridor Expansion',
        amount: 3_000_000,
        description: 'Dedicated airport transfer bay privileges and express executive shuttles.',
      },
    ],
    expenseBreakdown: [
      { category: 'Transport & Fuel', amount: 9_200_000, percentage: 40, color: '#1a52c4' },
      { category: 'Salaries & Drivers', amount: 6_900_000, percentage: 30, color: '#2f7a72' },
      { category: 'Leasing & Maintenance', amount: 3_450_000, percentage: 15, color: '#b0663a' },
      { category: 'Marketing & OTAs', amount: 2_300_000, percentage: 10, color: '#6b4f9e' },
      { category: 'Admin & Misc', amount: 1_150_000, percentage: 5, color: '#9a7b28' },
    ],
  },
  {
    id: 'branch-dar',
    businessId: 'biz-travkings',
    name: 'DAR',
    code: 'DAR',
    investment: 7_500_000, // ₹75L
    revenue: 18_000_000, // ₹1.8 Cr
    expenses: 19_000_000, // ₹1.9 Cr
    profit: -1_000_000, // -₹10L
    roi: -13.3,
    profitMargin: -5.6,
    growthPercent: -3.2,
    status: 'LOSS',
    partners: generatePartnerShares('branch-dar', -1_000_000),
    monthlyRevenue: [
      { month: 'Jan', amount: 3_100_000 },
      { month: 'Feb', amount: 2_900_000 },
      { month: 'Mar', amount: 3_000_000 },
      { month: 'Apr', amount: 2_900_000 },
      { month: 'May', amount: 3_100_000 },
      { month: 'Jun', amount: 3_000_000 },
    ],
    monthlyProfit: [
      { month: 'Jan', amount: -200_000 },
      { month: 'Feb', amount: -250_000 },
      { month: 'Mar', amount: -150_000 },
      { month: 'Apr', amount: -100_000 },
      { month: 'May', amount: -180_000 },
      { month: 'Jun', amount: -120_000 },
    ],
    investmentHistory: [
      {
        date: '01 Mar 2024',
        title: 'Dar es Salaam Regional Branch Launch',
        amount: 5_500_000,
        description: 'Cross-border tourist transport permit and port route licenses.',
      },
      {
        date: '18 Dec 2024',
        title: 'Route Restructuring Working Capital',
        amount: 2_000_000,
        description: 'Fleet maintenance overhaul and driver retraining.',
      },
    ],
    expenseBreakdown: [
      { category: 'Fleet Operating & Fuel Surcharge', amount: 8_550_000, percentage: 45, color: '#1a52c4' },
      { category: 'Salaries & Staff', amount: 5_700_000, percentage: 30, color: '#2f7a72' },
      { category: 'Station Depot Rent', amount: 2_850_000, percentage: 15, color: '#b0663a' },
      { category: 'Local Promotion', amount: 1_140_000, percentage: 6, color: '#6b4f9e' },
      { category: 'Cross-Border Permits', amount: 760_000, percentage: 4, color: '#9a7b28' },
    ],
  },
  {
    id: 'branch-fbm',
    businessId: 'biz-travkings',
    name: 'FBM',
    code: 'FBM',
    investment: 10_000_000, // ₹1.0 Cr
    revenue: 25_000_000, // ₹2.5 Cr
    expenses: 20_000_000, // ₹2.0 Cr
    profit: 5_000_000, // +₹50L
    roi: 50.0,
    profitMargin: 20.0,
    growthPercent: 15.8,
    status: 'STRONG',
    partners: generatePartnerShares('branch-fbm', 5_000_000),
    monthlyRevenue: [
      { month: 'Jan', amount: 3_800_000 },
      { month: 'Feb', amount: 4_000_000 },
      { month: 'Mar', amount: 4_100_000 },
      { month: 'Apr', amount: 4_300_000 },
      { month: 'May', amount: 4_300_000 },
      { month: 'Jun', amount: 4_500_000 },
    ],
    monthlyProfit: [
      { month: 'Jan', amount: 700_000 },
      { month: 'Feb', amount: 750_000 },
      { month: 'Mar', amount: 800_000 },
      { month: 'Apr', amount: 850_000 },
      { month: 'May', amount: 950_000 },
      { month: 'Jun', amount: 950_000 },
    ],
    investmentHistory: [
      {
        date: '12 Apr 2024',
        title: 'FBM Depot & Tour Operations',
        amount: 8_000_000,
        description: 'Tour equipment, luxury tempo travelers, and booking counters.',
      },
      {
        date: '14 Sep 2024',
        title: 'Corporate Travel Contract Expansion',
        amount: 2_000_000,
        description: 'Contract vehicles and dedicated chauffeur program.',
      },
    ],
    expenseBreakdown: [
      { category: 'Transport & Fuel', amount: 8_000_000, percentage: 40, color: '#1a52c4' },
      { category: 'Salaries & Chauffeurs', amount: 6_000_000, percentage: 30, color: '#2f7a72' },
      { category: 'Depot & Fleet Maintenance', amount: 3_000_000, percentage: 15, color: '#b0663a' },
      { category: 'B2B Partner Commissions', amount: 2_000_000, percentage: 10, color: '#6b4f9e' },
      { category: 'Insurance & Licenses', amount: 1_000_000, percentage: 5, color: '#9a7b28' },
    ],
  },
  {
    id: 'branch-nbo',
    businessId: 'biz-travkings',
    name: 'NBO',
    code: 'NBO',
    investment: 8_500_000, // ₹85L
    revenue: 21_000_000, // ₹2.1 Cr
    expenses: 18_000_000, // ₹1.8 Cr
    profit: 3_000_000, // +₹30L
    roi: 35.3,
    profitMargin: 14.3,
    growthPercent: 9.5,
    status: 'GOOD',
    partners: generatePartnerShares('branch-nbo', 3_000_000),
    monthlyRevenue: [
      { month: 'Jan', amount: 3_200_000 },
      { month: 'Feb', amount: 3_300_000 },
      { month: 'Mar', amount: 3_500_000 },
      { month: 'Apr', amount: 3_600_000 },
      { month: 'May', amount: 3_600_000 },
      { month: 'Jun', amount: 3_800_000 },
    ],
    monthlyProfit: [
      { month: 'Jan', amount: 400_000 },
      { month: 'Feb', amount: 450_000 },
      { month: 'Mar', amount: 500_000 },
      { month: 'Apr', amount: 550_000 },
      { month: 'May', amount: 550_000 },
      { month: 'Jun', amount: 550_000 },
    ],
    investmentHistory: [
      {
        date: '25 May 2024',
        title: 'Nairobi Airport Hub & Safari Fleet',
        amount: 6_500_000,
        description: 'Four 4WD safari cruisers, regional agency hub, and licensing.',
      },
      {
        date: '02 Feb 2025',
        title: 'Tour Packaging & Ticketing Desk',
        amount: 2_000_000,
        description: 'Ticketing desk and airport lounge partner kiosk.',
      },
    ],
    expenseBreakdown: [
      { category: 'Transport & Safari Operations', amount: 7_200_000, percentage: 40, color: '#1a52c4' },
      { category: 'Salaries & Guides', amount: 5_400_000, percentage: 30, color: '#2f7a72' },
      { category: 'Depot & Vehicle Upkeep', amount: 2_700_000, percentage: 15, color: '#b0663a' },
      { category: 'Promotion & Agents', amount: 1_800_000, percentage: 10, color: '#6b4f9e' },
      { category: 'Park Fees & Compliance', amount: 900_000, percentage: 5, color: '#9a7b28' },
    ],
  },
];

// 2. The 5 Major Businesses
export const initialBusinesses: Business[] = [
  {
    id: 'biz-travkings',
    name: 'Travkings Tour and Travels',
    shortName: 'Travkings',
    code: 'TRAV',
    investment: 52_000_000, // ₹5.2 Cr
    revenue: 118_000_000, // ₹11.8 Cr
    expenses: 94_000_000, // ₹9.4 Cr
    profit: 24_000_000, // +₹2.4 Cr
    roi: 46.15,
    currentValue: 78_000_000, // ₹7.8 Cr
    branchesCount: 5,
    partnersCount: 4,
    sparkline: [16, 18, 20, 21, 23, 24],
    status: 'STRONG',
    partners: generatePartnerShares('biz-travkings', 24_000_000),
    branches: initialTravkingsBranches,
    allocationPercent: 40.6, // ~41%
    initialInvestment: 38_000_000,
    additionalInvestment: 14_000_000,
    monthlyData: [
      { month: 'Jan', revenue: 18_000_000, expenses: 14_500_000, profit: 3_500_000, investment: 52_000_000 },
      { month: 'Feb', revenue: 19_000_000, expenses: 15_200_000, profit: 3_800_000, investment: 52_000_000 },
      { month: 'Mar', revenue: 19_800_000, expenses: 15_800_000, profit: 4_000_000, investment: 52_000_000 },
      { month: 'Apr', revenue: 20_100_000, expenses: 16_000_000, profit: 4_100_000, investment: 52_000_000 },
      { month: 'May', revenue: 20_300_000, expenses: 16_200_000, profit: 4_100_000, investment: 52_000_000 },
      { month: 'Jun', revenue: 20_700_000, expenses: 16_300_000, profit: 4_400_000, investment: 52_000_000 },
    ],
  },
  {
    id: 'biz-quinaliza',
    name: 'QuinALiza',
    shortName: 'QuinALiza',
    code: 'QAL',
    investment: 21_000_000, // ₹2.1 Cr
    revenue: 42_000_000, // ₹4.2 Cr
    expenses: 35_000_000, // ₹3.5 Cr
    profit: 7_000_000, // +₹70L
    roi: 33.33,
    currentValue: 29_000_000, // ₹2.9 Cr
    branchesCount: 1,
    partnersCount: 4,
    sparkline: [5.2, 5.8, 6.1, 6.4, 6.7, 7.0],
    status: 'GOOD',
    partners: generatePartnerShares('biz-quinaliza', 7_000_000),
    allocationPercent: 16.4, // ~17%
    initialInvestment: 16_000_000,
    additionalInvestment: 5_000_000,
    monthlyData: [
      { month: 'Jan', revenue: 6_500_000, expenses: 5_500_000, profit: 1_000_000 },
      { month: 'Feb', revenue: 6_800_000, expenses: 5_700_000, profit: 1_100_000 },
      { month: 'Mar', revenue: 7_000_000, expenses: 5_800_000, profit: 1_200_000 },
      { month: 'Apr', revenue: 7_100_000, expenses: 5_900_000, profit: 1_200_000 },
      { month: 'May', revenue: 7_200_000, expenses: 6_000_000, profit: 1_200_000 },
      { month: 'Jun', revenue: 7_400_000, expenses: 6_100_000, profit: 1_300_000 },
    ],
  },
  {
    id: 'biz-kings-logistic',
    name: 'Kings Logistic',
    shortName: 'Kings Logistic',
    code: 'KLOG',
    investment: 18_000_000, // ₹1.8 Cr
    revenue: 41_000_000, // ₹4.1 Cr
    expenses: 36_000_000, // ₹3.6 Cr
    profit: 5_000_000, // +₹50L
    roi: 27.78,
    currentValue: 24_000_000, // ₹2.4 Cr
    branchesCount: 1,
    partnersCount: 4,
    sparkline: [3.8, 4.0, 4.3, 4.6, 4.8, 5.0],
    status: 'GOOD',
    partners: generatePartnerShares('biz-kings-logistic', 5_000_000),
    allocationPercent: 14.1, // ~14%
    initialInvestment: 14_000_000,
    additionalInvestment: 4_000_000,
    monthlyData: [
      { month: 'Jan', revenue: 6_400_000, expenses: 5_600_000, profit: 800_000 },
      { month: 'Feb', revenue: 6_600_000, expenses: 5_800_000, profit: 800_000 },
      { month: 'Mar', revenue: 6_900_000, expenses: 6_100_000, profit: 800_000 },
      { month: 'Apr', revenue: 7_000_000, expenses: 6_150_000, profit: 850_000 },
      { month: 'May', revenue: 7_050_000, expenses: 6_200_000, profit: 850_000 },
      { month: 'Jun', revenue: 7_050_000, expenses: 6_150_000, profit: 900_000 },
    ],
  },
  {
    id: 'biz-hotel-kings',
    name: 'Hotel Kings Palace',
    shortName: 'Hotel Kings',
    code: 'HKP',
    investment: 24_000_000, // ₹2.4 Cr
    revenue: 31_000_000, // ₹3.1 Cr
    expenses: 35_000_000, // ₹3.5 Cr
    profit: -4_000_000, // -₹40L
    roi: -16.67,
    currentValue: 25_000_000, // ₹2.5 Cr
    branchesCount: 1,
    partnersCount: 4,
    sparkline: [-2.5, -3.0, -3.2, -3.6, -3.8, -4.0],
    status: 'LOSS',
    partners: generatePartnerShares('biz-hotel-kings', -4_000_000),
    allocationPercent: 18.75, // ~19%
    initialInvestment: 20_000_000,
    additionalInvestment: 4_000_000,
    monthlyData: [
      { month: 'Jan', revenue: 5_200_000, expenses: 5_800_000, profit: -600_000 },
      { month: 'Feb', revenue: 5_100_000, expenses: 5_750_000, profit: -650_000 },
      { month: 'Mar', revenue: 5_300_000, expenses: 5_950_000, profit: -650_000 },
      { month: 'Apr', revenue: 5_150_000, expenses: 5_850_000, profit: -700_000 },
      { month: 'May', revenue: 5_100_000, expenses: 5_800_000, profit: -700_000 },
      { month: 'Jun', revenue: 5_150_000, expenses: 5_850_000, profit: -700_000 },
    ],
  },
  {
    id: 'biz-techkings',
    name: 'Techkings',
    shortName: 'Techkings',
    code: 'TECH',
    investment: 13_000_000, // ₹1.3 Cr
    revenue: 27_000_000, // ₹2.7 Cr
    expenses: 21_000_000, // ₹2.1 Cr
    profit: 6_000_000, // +₹60L
    roi: 46.15,
    currentValue: 18_000_000, // ₹1.8 Cr
    branchesCount: 1,
    partnersCount: 4,
    sparkline: [4.2, 4.6, 5.0, 5.3, 5.7, 6.0],
    status: 'STRONG',
    partners: generatePartnerShares('biz-techkings', 6_000_000),
    allocationPercent: 10.15, // ~9-10%
    initialInvestment: 10_000_000,
    additionalInvestment: 3_000_000,
    monthlyData: [
      { month: 'Jan', revenue: 4_200_000, expenses: 3_300_000, profit: 900_000 },
      { month: 'Feb', revenue: 4_350_000, expenses: 3_400_000, profit: 950_000 },
      { month: 'Mar', revenue: 4_500_000, expenses: 3_500_000, profit: 1_000_000 },
      { month: 'Apr', revenue: 4_600_000, expenses: 3_550_000, profit: 1_050_000 },
      { month: 'May', revenue: 4_650_000, expenses: 3_600_000, profit: 1_050_000 },
      { month: 'Jun', revenue: 4_700_000, expenses: 3_650_000, profit: 1_050_000 },
    ],
  },
];

// 3. Overall Portfolio Monthly Combined Financial Performance
export const portfolioMonthlyData: MonthlyDataPoint[] = [
  { month: 'Jan', revenue: 40_300_000, expenses: 34_700_000, profit: 5_600_000 },
  { month: 'Feb', revenue: 42_050_000, expenses: 35_850_000, profit: 6_200_000 },
  { month: 'Mar', revenue: 44_200_000, expenses: 37_150_000, profit: 7_050_000 },
  { month: 'Apr', revenue: 45_450_000, expenses: 37_450_000, profit: 8_000_000 },
  { month: 'May', revenue: 46_250_000, expenses: 37_800_000, profit: 8_450_000 },
  { month: 'Jun', revenue: 48_000_000, expenses: 38_050_000, profit: 9_950_000 },
];

// 4. Portfolio Growth Over Time
export const portfolioGrowthData = [
  { year: '2024', investment: 128_000_000, currentValue: 135_000_000, profit: 24_000_000 },
  { year: '2025', investment: 128_000_000, currentValue: 152_000_000, profit: 34_000_000 },
  { year: '2026', investment: 128_000_000, currentValue: 174_000_000, profit: 46_000_000 },
];

// 5. Recent Financial Activity / Transactions
export const initialTransactions: FinancialTransaction[] = [
  {
    id: 'tx-101',
    date: '02 Oct 2026',
    business: 'Travkings Tour and Travels',
    businessId: 'biz-travkings',
    branch: 'MHUB',
    type: 'Revenue',
    amount: 820_000,
    category: 'Corporate Group Tour Package',
    status: 'Completed',
  },
  {
    id: 'tx-102',
    date: '01 Oct 2026',
    business: 'Travkings Tour and Travels',
    businessId: 'biz-travkings',
    branch: 'BOM',
    type: 'Expense',
    amount: 310_000,
    category: 'Vehicle Maintenance & Fuel',
    status: 'Completed',
  },
  {
    id: 'tx-103',
    date: '29 Sep 2026',
    business: 'Techkings',
    businessId: 'biz-techkings',
    type: 'Profit',
    amount: 510_000,
    category: 'SaaS Enterprise Subscription Retainer',
    status: 'Completed',
  },
  {
    id: 'tx-104',
    date: '28 Sep 2026',
    business: 'Travkings Tour and Travels',
    businessId: 'biz-travkings',
    branch: 'FBM',
    type: 'Investment',
    amount: 2_500_000,
    category: 'Branch Fleet Capacity Expansion',
    status: 'Completed',
  },
  {
    id: 'tx-105',
    date: '27 Sep 2026',
    business: 'QuinALiza',
    businessId: 'biz-quinaliza',
    type: 'Revenue',
    amount: 1_250_000,
    category: 'Retail Product Consignment Sales',
    status: 'Completed',
  },
  {
    id: 'tx-106',
    date: '25 Sep 2026',
    business: 'Hotel Kings Palace',
    businessId: 'biz-hotel-kings',
    type: 'Expense',
    amount: 680_000,
    category: 'HVAC & Facility Renovation',
    status: 'Completed',
  },
  {
    id: 'tx-107',
    date: '24 Sep 2026',
    business: 'Kings Logistic',
    businessId: 'biz-kings-logistic',
    type: 'Revenue',
    amount: 940_000,
    category: 'Long-haul Freight Invoicing',
    status: 'Completed',
  },
  {
    id: 'tx-108',
    date: '22 Sep 2026',
    business: 'Travkings Tour and Travels',
    businessId: 'biz-travkings',
    type: 'Partner Distribution',
    amount: 2_000_000,
    category: 'Q3 Partner Dividend Equal Share',
    status: 'Completed',
  },
  {
    id: 'tx-109',
    date: '20 Sep 2026',
    business: 'Hotel Kings Palace',
    businessId: 'biz-hotel-kings',
    type: 'Withdrawal',
    amount: 450_000,
    category: 'Emergency Working Capital Draw',
    status: 'Completed',
  },
  {
    id: 'tx-110',
    date: '18 Sep 2026',
    business: 'Travkings Tour and Travels',
    businessId: 'biz-travkings',
    branch: 'DAR',
    type: 'Expense',
    amount: 190_000,
    category: 'Port Handling & Licensing Fees',
    status: 'Completed',
  },
];
