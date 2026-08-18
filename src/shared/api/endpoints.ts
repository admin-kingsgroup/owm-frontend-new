export const endpoints = {
  companies: {
    list: () => '/companies',
    create: () => '/companies',
    byId: (companyId: string) => `/companies/${companyId}`,
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
  },
  voucherTypes: {
    list: (companyId: string) => `/companies/${companyId}/voucher-types`,
    create: (companyId: string) => `/companies/${companyId}/voucher-types`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/voucher-types/${id}`,
  },
  vouchers: {
    list: (companyId: string) => `/companies/${companyId}/vouchers`,
    create: (companyId: string) => `/companies/${companyId}/vouchers`,
    byId: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}`,
    post: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/post`,
    cancel: (companyId: string, id: string) => `/companies/${companyId}/vouchers/${id}/cancel`,
  },
} as const;
