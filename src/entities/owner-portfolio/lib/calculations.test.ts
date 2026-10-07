import { describe, it, expect } from 'vitest';
import {
  calculateProfit,
  calculateRoi,
  calculatePartnerShare,
  generatePartnerShares,
  formatCrLakh,
  formatPercent,
  calculateTravkingsTotals,
  calculatePortfolioTotals,
  calculateInsights,
} from './calculations';
import { initialBusinesses, initialTravkingsBranches } from '../model/mock-data';

describe('Owner Wealth Management Calculations', () => {
  it('calculates profit = revenue - expenses', () => {
    expect(calculateProfit(118_000_000, 94_000_000)).toBe(24_000_000); // Travkings: 11.8Cr - 9.4Cr = 2.4Cr
    expect(calculateProfit(42_000_000, 35_000_000)).toBe(7_000_000); // QuinALiza: 4.2Cr - 3.5Cr = 70L
    expect(calculateProfit(31_000_000, 35_000_000)).toBe(-4_000_000); // Hotel Kings: 3.1Cr - 3.5Cr = -40L loss
  });

  it('calculates ROI percentage = (profit / investment) * 100', () => {
    expect(calculateRoi(24_000_000, 52_000_000)).toBe(46.2); // Travkings 46.2%
    expect(calculateRoi(7_000_000, 21_000_000)).toBe(33.3); // QuinALiza 33.3%
    expect(calculateRoi(-4_000_000, 24_000_000)).toBe(-16.7); // Hotel Kings -16.7%
    expect(calculateRoi(6_000_000, 12_000_000)).toBe(50.0); // MHUB 50%
    expect(calculateRoi(-1_000_000, 7_500_000)).toBe(-13.3); // DAR -13.3%
  });

  it('calculates dynamic equal 25% partner share for 4 partners', () => {
    // 40 Lakhs profit -> 10 Lakhs each
    expect(calculatePartnerShare(4_000_000, 4)).toBe(1_000_000);

    // Negative profit (Loss of 40 Lakhs) -> -10 Lakhs each
    expect(calculatePartnerShare(-4_000_000, 4)).toBe(-1_000_000);

    // Portfolio profit of ₹4.6 Cr -> Owner's share is ₹1.15 Cr
    expect(calculatePartnerShare(46_000_000, 4)).toBe(11_500_000);
  });

  it('generates 4 partner shares totaling 100%', () => {
    const partners = generatePartnerShares('biz-sample', 4_000_000);
    expect(partners.length).toBe(4);
    const totalPercentage = partners.reduce((sum, p) => sum + p.sharePercentage, 0);
    expect(totalPercentage).toBe(100);
    expect(partners[0].profitShare).toBe(1_000_000);
    expect(partners[3].profitShare).toBe(1_000_000);
  });

  it('formats figures in Indian Crore and Lakh format', () => {
    expect(formatCrLakh(128_000_000)).toBe('₹12.8 Cr');
    expect(formatCrLakh(174_000_000)).toBe('₹17.4 Cr');
    expect(formatCrLakh(46_000_000)).toBe('₹4.6 Cr');
    expect(formatCrLakh(24_000_000, { forceSign: true })).toBe('+₹2.4 Cr');
    expect(formatCrLakh(7_000_000, { forceSign: true })).toBe('+₹70L');
    expect(formatCrLakh(5_000_000, { forceSign: true })).toBe('+₹50L');
    expect(formatCrLakh(-4_000_000)).toBe('-₹40L');
    expect(formatCrLakh(-1_000_000)).toBe('-₹10L');
    expect(formatCrLakh(6_000_000, { forceSign: true })).toBe('+₹60L');
    expect(formatCrLakh(3_000_000, { forceSign: true })).toBe('+₹30L');
    expect(formatCrLakh(11_500_000)).toBe('₹1.15 Cr');
  });

  it('formats percentages with optional sign', () => {
    expect(formatPercent(46.1)).toBe('46.1%');
    expect(formatPercent(46.1, { forceSign: true })).toBe('+46.1%');
    expect(formatPercent(-16.7)).toBe('-16.7%');
  });

  it('calculates Travkings branch totals accurately', () => {
    const totals = calculateTravkingsTotals(initialTravkingsBranches);
    expect(totals.branchesCount).toBe(5);
    expect(totals.investment).toBe(47_000_000); // 1.2 + 0.9 + 0.75 + 1.0 + 0.85 = 4.7 Cr
    expect(totals.revenue).toBe(125_000_000); // 3.4 + 2.7 + 1.8 + 2.5 + 2.1 = 12.5 Cr
    expect(totals.expenses).toBe(108_000_000); // 2.8 + 2.3 + 1.9 + 2.0 + 1.8 = 10.8 Cr
    expect(totals.profit).toBe(17_000_000); // 12.5 Cr - 10.8 Cr = 1.7 Cr
  });

  it('calculates Portfolio totals across all 5 businesses', () => {
    const totals = calculatePortfolioTotals(initialBusinesses);
    expect(totals.totalInvestment).toBe(128_000_000); // ₹12.8 Cr
    expect(totals.totalRevenue).toBe(259_000_000); // ₹25.9 Cr
    expect(totals.totalExpenses).toBe(221_000_000); // ₹22.1 Cr
    expect(totals.totalProfit).toBe(38_000_000); // ₹3.8 Cr
    expect(totals.currentValue).toBe(174_000_000); // ₹17.4 Cr
    expect(totals.ownerShare).toBe(9_500_000); // 25% of ₹3.8 Cr
  });

  it('dynamically derives business insights', () => {
    const insights = calculateInsights(initialBusinesses, initialTravkingsBranches);
    expect(insights.length).toBeGreaterThanOrEqual(4);

    const hasHighestProfit = insights.some((i) => i.id === 'insight-highest-profit');
    expect(hasHighestProfit).toBe(true);

    const hasDarLoss = insights.some((i) => i.id.includes('branch-dar'));
    expect(hasDarLoss).toBe(true);

    const hasHotelLoss = insights.some((i) => i.id.includes('hotel-kings'));
    expect(hasHotelLoss).toBe(true);
  });
});
