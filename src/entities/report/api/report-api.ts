import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  BalanceSheetReport,
  DayBookReport,
  LedgerStatementReport,
  ProfitAndLossReport,
  TrialBalanceReport,
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
