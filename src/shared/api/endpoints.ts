export const endpoints = {
  companies: {
    list: () => '/companies',
    create: () => '/companies',
    byId: (companyId: string) => `/companies/${companyId}`,
  },
  financialYears: {
    list: (companyId: string) => `/companies/${companyId}/financial-years`,
    create: (companyId: string) => `/companies/${companyId}/financial-years`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/financial-years/${id}`,
    close: (companyId: string, id: string) =>
      `/companies/${companyId}/financial-years/${id}/close`,
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
  reports: {
    dayBook: (companyId: string) => `/companies/${companyId}/reports/day-book`,
    trialBalance: (companyId: string) => `/companies/${companyId}/reports/trial-balance`,
    balanceSheet: (companyId: string) => `/companies/${companyId}/reports/balance-sheet`,
    profitAndLoss: (companyId: string) => `/companies/${companyId}/reports/profit-and-loss`,
    groupSummary: (companyId: string) => `/companies/${companyId}/reports/group-summary`,
    ledger: (companyId: string, ledgerId: string) =>
      `/companies/${companyId}/reports/ledgers/${ledgerId}`,
  },
  vouchers: {
    list: (companyId: string) => `/companies/${companyId}/vouchers`,
    create: (companyId: string) => `/companies/${companyId}/vouchers`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}`,
    post: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/post`,
    cancel: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/cancel`,
  },
} as const;
