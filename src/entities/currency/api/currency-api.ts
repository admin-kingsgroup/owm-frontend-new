import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Currency,
  CreateCurrencyInput,
  ExchangeRate,
  CreateExchangeRateInput,
  ForexGainLossReport,
} from '../model/types';

export async function listCurrencies(companyId: string): Promise<Currency[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<Currency[]>>(
    endpoints.currencies.list(companyId),
  );
  return data.data;
}

export async function createCurrency(
  companyId: string,
  input: CreateCurrencyInput,
): Promise<Currency> {
  const { data } = await apiClient.post<ApiSuccessResponse<Currency>>(
    endpoints.currencies.create(companyId),
    input,
  );
  return data.data;
}

export async function listExchangeRates(companyId: string): Promise<ExchangeRate[]> {
  const { data } = await apiClient.get<ApiSuccessResponse<ExchangeRate[]>>(
    endpoints.currencies.rates(companyId),
  );
  return data.data;
}

export async function setExchangeRate(
  companyId: string,
  input: CreateExchangeRateInput,
): Promise<ExchangeRate> {
  const { data } = await apiClient.post<ApiSuccessResponse<ExchangeRate>>(
    endpoints.currencies.rates(companyId),
    input,
  );
  return data.data;
}

export async function getForexGainLoss(
  companyId: string,
  asOf?: string,
): Promise<ForexGainLossReport> {
  const { data } = await apiClient.get<ApiSuccessResponse<ForexGainLossReport>>(
    endpoints.currencies.gainLoss(companyId),
    { params: { asOf } },
  );
  return data.data;
}
