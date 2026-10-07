import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  MOCK_COMPANIES,
  getMockFinancialYears,
  getMockCurrencies,
  getMockExchangeRates,
  getMockVoucherTypes,
  getMockAccountGroups,
  getMockLedgers,
  getMockVouchers,
  createMockVoucher,
  getMockCompanyContext,
  getMockGroupOverview,
  getMockBalanceSheet,
  getMockProfitAndLoss,
  getMockTrialBalance,
  getMockDayBook,
  getMockCashFlow,
  getMockReceiptsAndPayments,
  getMockOutstandings,
} from './mock-erp-data';

export function handleMockRequest(
  config: InternalAxiosRequestConfig,
): AxiosResponse | null {
  const url = config.url || '';
  const method = (config.method || 'GET').toUpperCase();

  // Helper to construct success Axios response
  function reply(data: unknown, status = 200): AxiosResponse {
    return {
      data: {
        success: true,
        message: 'OK',
        data,
      },
      status,
      statusText: 'OK',
      headers: {},
      config,
    };
  }

  // 1. Companies
  if (url === '/companies' || url === '/companies/') {
    if (method === 'GET') {
      return reply(MOCK_COMPANIES);
    }
    if (method === 'POST') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      const newCompany = {
        id: `biz-${Date.now()}`,
        name: body?.name || 'New Company',
        code: body?.code || 'NEW',
        type: body?.type || 'TRADING',
        legalName: body?.legalName || body?.name,
        financialYearStart: body?.financialYearStart || '2026-04-01',
        financialYearEnd: body?.financialYearEnd || '2027-03-31',
        baseCurrency: body?.baseCurrency || 'INR',
        country: body?.country || 'IND',
        state: body?.state || 'Maharashtra',
        timezone: body?.timezone || 'Asia/Kolkata',
        status: 'ACTIVE' as const,
        initialized: true,
        seedVersion: 6,
        currentSeedVersion: 6,
        features: { billWiseDetails: true, multiCurrency: true },
      };
      MOCK_COMPANIES.push(newCompany);
      return reply(newCompany);
    }
  }

  // Single company
  const companyMatch = url.match(/^\/companies\/([^/?]+)(?:\?.*)?$/);
  if (companyMatch) {
    const compId = companyMatch[1];
    const found = MOCK_COMPANIES.find((c) => c.id === compId) || MOCK_COMPANIES[0];
    if (method === 'PATCH') {
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      Object.assign(found, body);
      return reply(found);
    }
    return reply(found);
  }

  // Extract companyId for nested routes
  const nestedMatch = url.match(/^\/companies\/([^/]+)\/(.+)$/);
  if (nestedMatch) {
    const companyId = nestedMatch[1];
    const subPath = nestedMatch[2].split('?')[0];

    // Vouchers
    if (subPath === 'vouchers') {
      if (method === 'GET') {
        const items = getMockVouchers(companyId);
        return reply({
          items,
          total: items.length,
          page: 1,
          limit: 20,
        });
      }
      if (method === 'POST') {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        const newVoucher = createMockVoucher(companyId, body);
        return reply(newVoucher);
      }
    }

    if (subPath.startsWith('vouchers/')) {
      const vchParts = subPath.split('/');
      const vchId = vchParts[1];
      const action = vchParts[2];
      const allVouchers = getMockVouchers(companyId);
      const voucher = allVouchers.find((v) => v.id === vchId) || allVouchers[0];

      if (action === 'post' && voucher) {
        voucher.status = 'POSTED';
        voucher.postedAt = new Date().toISOString();
        return reply(voucher);
      }
      if (action === 'cancel' && voucher) {
        voucher.status = 'CANCELLED';
        voucher.cancelledAt = new Date().toISOString();
        return reply(voucher);
      }
      return reply(voucher);
    }

    // Voucher types
    if (subPath === 'voucher-types') {
      return reply(getMockVoucherTypes(companyId));
    }

    // Ledgers
    if (subPath === 'ledgers') {
      if (method === 'GET') {
        return reply(getMockLedgers(companyId));
      }
      if (method === 'POST') {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        const newLedger = {
          id: `${companyId}-led-${Date.now()}`,
          companyId,
          accountGroupId: `${companyId}-grp-dir-exp`,
          code: body?.code || `LED_${Date.now()}`,
          name: body?.name || 'New Ledger',
          ledgerType: body?.ledgerType || 'GENERAL',
          openingBalance: String(body?.openingBalance || 0),
          openingBalanceType: body?.openingBalanceType || 'DEBIT',
          maintainBillwise: !!body?.maintainBillwise,
          isSystem: false,
          isActive: true,
        };
        return reply(newLedger);
      }
    }

    // Account groups
    if (subPath === 'account-groups') {
      return reply(getMockAccountGroups(companyId));
    }

    // Financial years
    if (subPath === 'financial-years') {
      return reply(getMockFinancialYears(companyId));
    }

    // Currencies
    if (subPath === 'currencies') {
      return reply(getMockCurrencies(companyId));
    }
    if (subPath === 'currencies/rates') {
      return reply(getMockExchangeRates(companyId));
    }
    if (subPath === 'currencies/gain-loss') {
      return reply({
        asOfDate: '2026-10-07',
        baseCurrency: 'INR',
        totalGainLoss: '345000',
        items: [
          { currencyCode: 'USD', balance: '120000', bookingRate: '82.50', currentRate: '83.50', unrealizedGainLoss: '120000' },
          { currencyCode: 'EUR', balance: '75000', bookingRate: '88.20', currentRate: '91.20', unrealizedGainLoss: '225000' },
        ],
      });
    }

    // Outstandings (Receivables & Payables)
    if (subPath === 'outstandings/receivables') {
      return reply(getMockOutstandings(companyId, 'DEBIT'));
    }
    if (subPath === 'outstandings/payables') {
      return reply(getMockOutstandings(companyId, 'CREDIT'));
    }

    // Reports
    if (subPath === 'reports/context') {
      return reply(getMockCompanyContext(companyId));
    }
    if (subPath === 'reports/balance-sheet') {
      return reply(getMockBalanceSheet(companyId));
    }
    if (subPath === 'reports/profit-and-loss') {
      return reply(getMockProfitAndLoss(companyId));
    }
    if (subPath === 'reports/trial-balance') {
      return reply(getMockTrialBalance(companyId));
    }
    if (subPath === 'reports/day-book') {
      return reply(getMockDayBook(companyId));
    }
    if (subPath === 'reports/cash-flow') {
      return reply(getMockCashFlow(companyId));
    }
    if (subPath === 'reports/receipts-and-payments') {
      return reply(getMockReceiptsAndPayments(companyId));
    }

    if (subPath === 'reports/group-summary') {
      return reply({
        financialYearLabel: '2026',
        asOfDate: '2026-10-07',
        baseCurrency: 'INR',
        groups: [
          { groupId: 'g1', code: 'ASSETS', name: 'Assets', debit: '174000000', credit: '0', net: '174000000', side: 'DEBIT', children: [] },
          { groupId: 'g2', code: 'LIABILITIES', name: 'Liabilities', debit: '0', credit: '174000000', net: '174000000', side: 'CREDIT', children: [] },
          { groupId: 'g3', code: 'INCOMES', name: 'Incomes', debit: '0', credit: '287000000', net: '287000000', side: 'CREDIT', children: [] },
          { groupId: 'g4', code: 'EXPENSES', name: 'Expenses', debit: '241000000', credit: '0', net: '241000000', side: 'DEBIT', children: [] },
        ],
      });
    }

    if (subPath === 'reports/cash-book' || subPath === 'reports/bank-book') {
      const isCash = subPath === 'reports/cash-book';
      return reply([
        {
          ledgerId: isCash ? 'led-cash' : 'led-hdfc',
          ledgerCode: isCash ? 'CASH' : 'HDFC_BANK',
          ledgerName: isCash ? 'Cash in Hand' : 'HDFC Corporate Account',
          openingBalance: isCash ? '2500000' : '48500000',
          openingSide: 'DEBIT',
          closingBalance: isCash ? '2750000' : '52400000',
          closingSide: 'DEBIT',
          totalDebit: '1250000',
          totalCredit: '1000000',
          entries: [
            {
              voucherId: 'v1',
              voucherNumber: 'RCT-0001',
              voucherType: 'RECEIPT',
              voucherDate: '2026-10-05',
              particulars: 'Al Habtoor Travels LLC',
              debit: '1250000',
              credit: '0',
              runningBalance: '49750000',
              runningSide: 'DEBIT',
            },
            {
              voucherId: 'v2',
              voucherNumber: 'PMT-0001',
              voucherType: 'PAYMENT',
              voucherDate: '2026-10-06',
              particulars: 'Emirates Airlines B2B Corporate',
              debit: '0',
              credit: '1000000',
              runningBalance: '48750000',
              runningSide: 'DEBIT',
            },
          ],
        },
      ]);
    }

    if (subPath.startsWith('reports/ledgers/')) {
      const parts = subPath.split('/');
      const ledId = parts[2] || 'led-hdfc';
      return reply({
        ledgerId: ledId,
        ledgerCode: 'HDFC_BANK',
        ledgerName: 'HDFC Corporate Account',
        openingBalance: '48500000',
        openingSide: 'DEBIT',
        closingBalance: '50950000',
        closingSide: 'DEBIT',
        totalDebit: '4800000',
        totalCredit: '2350000',
        entries: [
          {
            voucherId: 'v-1',
            voucherNumber: 'RCT-0001',
            voucherType: 'RECEIPT',
            voucherDate: '2026-10-05',
            particulars: 'Al Habtoor Travels LLC',
            debit: '4800000',
            credit: '0',
            runningBalance: '53300000',
            runningSide: 'DEBIT',
          },
          {
            voucherId: 'v-2',
            voucherNumber: 'PMT-0001',
            voucherType: 'PAYMENT',
            voucherDate: '2026-10-06',
            particulars: 'Emirates Airlines Corporate',
            debit: '0',
            credit: '2350000',
            runningBalance: '50950000',
            runningSide: 'DEBIT',
          },
        ],
      });
    }

    if (subPath.startsWith('reports/bank-reconciliation/')) {
      return reply({
        bankLedgerName: 'HDFC Corporate Account',
        asOfDate: '2026-10-07',
        baseCurrency: 'INR',
        balanceAsPerCompanyBooks: '48500000',
        amountsNotReflectedInBank: '0',
        balanceAsPerBank: '48500000',
        difference: '0',
        reconciled: true,
        unreconciledEntries: [],
      });
    }

    if (subPath === 'reports/monthly-summary') {
      return reply({
        financialYearLabel: '2026',
        baseCurrency: 'INR',
        months: [
          { month: 'Apr 2026', debit: '42000000', credit: '48000000', closing: '6000000' },
          { month: 'May 2026', debit: '39000000', credit: '45000000', closing: '12000000' },
          { month: 'Jun 2026', debit: '41000000', credit: '49000000', closing: '20000000' },
          { month: 'Jul 2026', debit: '45000000', credit: '53000000', closing: '28000000' },
          { month: 'Aug 2026', debit: '43000000', credit: '51000000', closing: '36000000' },
          { month: 'Sep 2026', debit: '46000000', credit: '54000000', closing: '44000000' },
          { month: 'Oct 2026', debit: '48000000', credit: '50000000', closing: '46000000' },
        ],
      });
    }

    if (subPath === 'reports/ratios') {
      return reply({
        financialYearLabel: '2026',
        asOfDate: '2026-10-07',
        ratios: [
          { name: 'Current Ratio', value: '1.42', formula: 'Current Assets / Current Liabilities', benchmark: '> 1.20', status: 'HEALTHY' },
          { name: 'Quick Ratio', value: '1.38', formula: '(Cash + Bank + Debtors) / Current Liabilities', benchmark: '> 1.00', status: 'HEALTHY' },
          { name: 'Net Profit Margin', value: '16.03%', formula: 'Net Profit / Total Revenue', benchmark: '> 12.00%', status: 'HEALTHY' },
          { name: 'Return on Equity (ROE)', value: '35.94%', formula: 'Net Profit / Total Capital', benchmark: '> 20.00%', status: 'EXCELLENT' },
          { name: 'Debt to Equity', value: '0.00', formula: 'Total Debt / Capital', benchmark: '< 0.50', status: 'EXCELLENT' },
        ],
      });
    }

    if (subPath === 'reports/funds-flow') {
      return reply({
        financialYearLabel: '2026',
        baseCurrency: 'INR',
        sourcesOfFunds: [
          { label: 'Funds from Business Operations', amount: '46000000' },
          { label: 'Capital Additions', amount: '7000000' },
        ],
        applicationsOfFunds: [
          { label: 'Fleet & Equipment Additions', amount: '12000000' },
          { label: 'Increase in Working Capital', amount: '41000000' },
        ],
        totalSources: '53000000',
        totalApplications: '53000000',
        balanced: true,
      });
    }

    if (subPath === 'reports/exceptions') {
      return reply({
        financialYearLabel: '2026',
        asOfDate: '2026-10-07',
        exceptionsFound: 0,
        items: [],
        message: 'No exceptions found. All double-entry books and registers are in balance.',
      });
    }
  }

  // 8. Global Reports
  if (url === '/reports/group-overview' || url.startsWith('/reports/group-overview')) {
    return reply(getMockGroupOverview());
  }

  return null;
}
