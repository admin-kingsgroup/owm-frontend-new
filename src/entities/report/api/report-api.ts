import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  BalanceSheetReport,
  GroupOverview,
  DayBookReport,
  LedgerStatementReport,
  ProfitAndLossReport,
  TrialBalanceReport,
  CompanyContext,
  ReportNode,
  ReceiptsAndPaymentsReport,
  CashFlowReport,
  BankReconciliationReport,
  MonthlySummaryReport,
  AuditList,
  AuditEntity,
} from '../model/types';

/** Day Book narrowed to one voucher type — Tally's Sales, Purchase, Journal and other registers. */
export interface RegisterParams extends ReportParams {
  voucherTypeCodes?: string[];
}

export interface ReportParams {
  financialYearId?: string;
  from?: string;
  to?: string;
  /** Ask for a prior-year column. Only the balance sheet and the profit and loss honour it. */
  compare?: boolean;
}

async function fetchReport<T>(url: string, params: ReportParams): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, { params });
  return data.data;
}

/** Every cash account's statement, one after another — Tally's Cash Book. */
export const getCashBook = (companyId: string, params: ReportParams = {}) =>
  fetchReport<LedgerStatementReport[]>(endpoints.reports.cashBook(companyId), params);

/** The same for bank accounts. */
export const getBankBook = (companyId: string, params: ReportParams = {}) =>
  fetchReport<LedgerStatementReport[]>(endpoints.reports.bankBook(companyId), params);

/** Every account group with its closing position, as a tree. */
export const getGroupSummary = (companyId: string, params: ReportParams = {}) =>
  fetchReport<ReportNode[]>(endpoints.reports.groupSummary(companyId), params);

export const getCompanyContext = (companyId: string) =>
  fetchReport<CompanyContext>(endpoints.reports.context(companyId), {});

export const getTrialBalance = (companyId: string, params: ReportParams = {}) =>
  fetchReport<TrialBalanceReport>(endpoints.reports.trialBalance(companyId), params);

export const getBalanceSheet = (companyId: string, params: ReportParams = {}) =>
  fetchReport<BalanceSheetReport>(endpoints.reports.balanceSheet(companyId), params);

export const getProfitAndLoss = (companyId: string, params: ReportParams = {}) =>
  fetchReport<ProfitAndLossReport>(endpoints.reports.profitAndLoss(companyId), params);

export const getDayBook = (companyId: string, params: ReportParams = {}) =>
  fetchReport<DayBookReport>(endpoints.reports.dayBook(companyId), params);

export const getLedgerStatement = (
  companyId: string,
  ledgerId: string,
  params: ReportParams = {},
) => fetchReport<LedgerStatementReport>(endpoints.reports.ledger(companyId, ledgerId), params);

/** Every company the signed-in user may reach, with its cash, profit and draft backlog. */
export const getGroupOverview = () =>
  fetchReport<GroupOverview>(endpoints.reports.groupOverview(), {});

export const getReceiptsAndPayments = (companyId: string, params: ReportParams = {}) =>
  fetchReport<ReceiptsAndPaymentsReport>(endpoints.reports.receiptsAndPayments(companyId), params);

export const getCashFlow = (companyId: string, params: ReportParams = {}) =>
  fetchReport<CashFlowReport>(endpoints.reports.cashFlow(companyId), params);

/** The Day Book, narrowed to one voucher type. Passing none of them is the Day Book itself. */
export const getRegister = (companyId: string, params: RegisterParams = {}) =>
  fetchReport<DayBookReport>(endpoints.reports.dayBook(companyId), params as ReportParams);

export const getBankReconciliation = (
  companyId: string,
  ledgerId: string,
  params: ReportParams = {},
) =>
  fetchReport<BankReconciliationReport>(
    endpoints.reports.bankReconciliation(companyId, ledgerId),
    params,
  );

export const getMonthlySummary = (
  companyId: string,
  target: { ledgerId?: string; groupId?: string },
  params: ReportParams = {},
) =>
  fetchReport<MonthlySummaryReport>(endpoints.reports.monthlySummary(companyId), {
    ...params,
    ...target,
  } as ReportParams);

/** The record of who changed what. Read-only: there is no endpoint that writes or edits one. */
export const getAuditTrail = (
  companyId: string,
  params: { entity?: AuditEntity; entityId?: string; from?: string; to?: string; limit?: number },
) => fetchReport<AuditList>(endpoints.audit(companyId), params as ReportParams);
