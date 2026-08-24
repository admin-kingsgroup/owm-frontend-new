export const endpoints = {
  companies: {
    list: () => '/companies',
    create: () => '/companies',
    byId: (companyId: string) => `/companies/${companyId}`,
    seedPreview: (type: string) => `/companies/seed-preview?type=${encodeURIComponent(type)}`,
    syncDefaultMasters: (companyId: string) => `/companies/${companyId}/sync-default-masters`,
    pendingDefaultMasters: (companyId: string) =>
      `/companies/${companyId}/default-masters/pending`,
  },
  financialYears: {
    list: (companyId: string) => `/companies/${companyId}/financial-years`,
    create: (companyId: string) => `/companies/${companyId}/financial-years`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/financial-years/${id}`,
    close: (companyId: string, id: string) => `/companies/${companyId}/financial-years/${id}/close`,
    reopen: (companyId: string, id: string) =>
      `/companies/${companyId}/financial-years/${id}/reopen`,
  },
  accountGroups: {
    list: (companyId: string) => `/companies/${companyId}/account-groups`,
    create: (companyId: string) => `/companies/${companyId}/account-groups`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/account-groups/${id}`,
  },
  ledgers: {
    list: (companyId: string) => `/companies/${companyId}/ledgers`,
    create: (companyId: string) => `/companies/${companyId}/ledgers`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/ledgers/${id}`,
    openingBalanceSummary: (companyId: string) =>
      `/companies/${companyId}/ledgers/opening-balance-summary`,
  },
  voucherTypes: {
    list: (companyId: string) => `/companies/${companyId}/voucher-types`,
    create: (companyId: string) => `/companies/${companyId}/voucher-types`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/voucher-types/${id}`,
  },
  numberSeries: {
    list: (companyId: string) => `/companies/${companyId}/number-series`,
  },
  currencies: {
    list: (companyId: string) => `/companies/${companyId}/currencies`,
    create: (companyId: string) => `/companies/${companyId}/currencies`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/currencies/${id}`,
    rates: (companyId: string) => `/companies/${companyId}/currencies/rates`,
    gainLoss: (companyId: string) => `/companies/${companyId}/currencies/gain-loss`,
  },
  /** KG Business. Company-scoped like everything else, nested under /kg. */
  kg: {
    partners: (companyId: string) => `/companies/${companyId}/kg/partners`,
    partner: (companyId: string, id: string) => `/companies/${companyId}/kg/partners/${id}`,
    businesses: (companyId: string) => `/companies/${companyId}/kg/businesses`,
    business: (companyId: string, id: string, force = false) =>
      `/companies/${companyId}/kg/businesses/${id}` + (force ? '?force=true' : ''),
    mappings: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/mappings`,
    imports: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/imports`,
    importPreview: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/imports/preview`,
    importTemplate: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/imports/template`,
    snapshots: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/snapshots`,
    lockSnapshot: (companyId: string, businessId: string, id: string) =>
      `/companies/${companyId}/kg/businesses/${businessId}/snapshots/${id}/lock`,
    ranking: (companyId: string, year: number, month: number) =>
      `/companies/${companyId}/kg/portfolio/ranking?periodYear=${year}&periodMonth=${month}`,
    partnerStatement: (companyId: string, partnerId: string, year: number, month: number) =>
      `/companies/${companyId}/kg/portfolio/partners/${partnerId}` +
      `?periodYear=${year}&periodMonth=${month}`,
    forecast: (companyId: string, businessId: string) =>
      `/companies/${companyId}/kg/portfolio/businesses/${businessId}/forecast`,
  },
  outstandings: {
    receivables: (companyId: string) => `/companies/${companyId}/outstandings/receivables`,
    payables: (companyId: string) => `/companies/${companyId}/outstandings/payables`,
  },
  /** Browser-side faults. Written by the error reporter, read only by an administrator. */
  clientErrors: {
    list: () => '/client-errors',
  },
  audit: (companyId: string) => `/companies/${companyId}/audit`,
  reconcileEntry: (companyId: string, voucherId: string, entryId: string) =>
    `/companies/${companyId}/vouchers/${voucherId}/entries/${entryId}/reconcile`,
  openingBills: (companyId: string, ledgerId: string) =>
    `/companies/${companyId}/ledgers/${ledgerId}/opening-bills`,
  reports: {
    /** Spans companies, so it is not nested under /companies/:companyId. */
    groupOverview: () => '/reports/group-overview',
    /** Period, difference and draft backlog in one call — what the app frame states. */
    context: (companyId: string) => `/companies/${companyId}/reports/context`,
    dayBook: (companyId: string) => `/companies/${companyId}/reports/day-book`,
    trialBalance: (companyId: string) => `/companies/${companyId}/reports/trial-balance`,
    balanceSheet: (companyId: string) => `/companies/${companyId}/reports/balance-sheet`,
    profitAndLoss: (companyId: string) => `/companies/${companyId}/reports/profit-and-loss`,
    groupSummary: (companyId: string) => `/companies/${companyId}/reports/group-summary`,
    cashBook: (companyId: string) => `/companies/${companyId}/reports/cash-book`,
    bankBook: (companyId: string) => `/companies/${companyId}/reports/bank-book`,
    receiptsAndPayments: (companyId: string) =>
      `/companies/${companyId}/reports/receipts-and-payments`,
    cashFlow: (companyId: string) => `/companies/${companyId}/reports/cash-flow`,
    ledger: (companyId: string, ledgerId: string) =>
      `/companies/${companyId}/reports/ledgers/${ledgerId}`,
    bankReconciliation: (companyId: string, ledgerId: string) =>
      `/companies/${companyId}/reports/bank-reconciliation/${ledgerId}`,
    monthlySummary: (companyId: string) => `/companies/${companyId}/reports/monthly-summary`,
    fundsFlow: (companyId: string) => `/companies/${companyId}/reports/funds-flow`,
    ratios: (companyId: string) => `/companies/${companyId}/reports/ratios`,
    exceptions: (companyId: string) => `/companies/${companyId}/reports/exceptions`,
    statementOfAccount: (companyId: string, ledgerId: string) =>
      `/companies/${companyId}/reports/statement-of-account/${ledgerId}`,
  },
  vouchers: {
    list: (companyId: string) => `/companies/${companyId}/vouchers`,
    create: (companyId: string) => `/companies/${companyId}/vouchers`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}`,
    post: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/post`,
    cancel: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/cancel`,
  },
} as const;
