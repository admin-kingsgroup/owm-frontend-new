import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  BalanceSheetReport,
  GroupOverview,
  DayBookReport,
  LedgerStatementReport,
  ProfitAndLossReport,
  TrialBalanceReport,
  ReceiptsAndPaymentsReport,
  CashFlowReport,
} from '../model/types';

export interface ReportParams {
  financialYearId?: string;
  from?: string;
  to?: string;
}

async function fetchReport<T>(url: string, params: ReportParams): Promise<T> {
  const { data } = await apiClient.get<ApiSuccessResponse<T>>(url, { params });
  return data.data;
}

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
  fetchReport<ReceiptsAndPaymentsReport>(
    endpoints.reports.receiptsAndPayments(companyId),
    params,
  );

export const getCashFlow = (companyId: string, params: ReportParams = {}) =>
  fetchReport<CashFlowReport>(endpoints.reports.cashFlow(companyId), params);
