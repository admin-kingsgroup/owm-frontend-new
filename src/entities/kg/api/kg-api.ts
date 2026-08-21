import { apiClient, endpoints } from '@/shared/api';
import type { ApiSuccessResponse } from '@/shared/types';

import type {
  Business,
  CreateBusinessInput,
  ForecastResult,
  ImportPreview,
  LedgerMapping,
  MappingInput,
  Partner,
  PartnerStatement,
  PortfolioView,
  Snapshot,
} from '../model/types';

const unwrap = <T>(response: { data: ApiSuccessResponse<T> }) => response.data.data;

// ---- partners -------------------------------------------------------------------------------

export async function listPartners(companyId: string): Promise<Partner[]> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<Partner[]>>(endpoints.kg.partners(companyId)),
  );
}

export async function createPartner(
  companyId: string,
  input: { code: string; name: string },
): Promise<Partner> {
  return unwrap(
    await apiClient.post<ApiSuccessResponse<Partner>>(endpoints.kg.partners(companyId), input),
  );
}

export async function deletePartner(companyId: string, id: string): Promise<void> {
  await apiClient.delete(endpoints.kg.partner(companyId, id));
}

// ---- businesses -----------------------------------------------------------------------------

export async function listBusinesses(companyId: string): Promise<Business[]> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<Business[]>>(endpoints.kg.businesses(companyId)),
  );
}

export async function createBusiness(
  companyId: string,
  input: CreateBusinessInput,
): Promise<Business> {
  return unwrap(
    await apiClient.post<ApiSuccessResponse<Business>>(endpoints.kg.businesses(companyId), input),
  );
}

/**
 * Deletes a business. `force` also destroys its snapshots and mappings, and is only for one created
 * by mistake — the server refuses without it the moment anything has been reported.
 */
export async function deleteBusiness(companyId: string, id: string, force = false): Promise<void> {
  await apiClient.delete(endpoints.kg.business(companyId, id, force));
}

// ---- mappings -------------------------------------------------------------------------------

export async function listMappings(
  companyId: string,
  businessId: string,
): Promise<LedgerMapping[]> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<LedgerMapping[]>>(
      endpoints.kg.mappings(companyId, businessId),
    ),
  );
}

export async function saveMappings(
  companyId: string,
  businessId: string,
  mappings: MappingInput[],
): Promise<{ written: number }> {
  return unwrap(
    await apiClient.put<ApiSuccessResponse<{ written: number }>>(
      endpoints.kg.mappings(companyId, businessId),
      { mappings },
    ),
  );
}

// ---- import ---------------------------------------------------------------------------------

export async function previewImport(
  companyId: string,
  businessId: string,
  content: string,
): Promise<ImportPreview> {
  return unwrap(
    await apiClient.post<ApiSuccessResponse<ImportPreview>>(
      endpoints.kg.importPreview(companyId, businessId),
      { format: 'CSV', content },
    ),
  );
}

export async function runImport(
  companyId: string,
  businessId: string,
  content: string,
  periodYear: number,
  periodMonth: number,
): Promise<{ snapshot: Snapshot; skipped: ImportPreview['skipped'] }> {
  return unwrap(
    await apiClient.post<
      ApiSuccessResponse<{ snapshot: Snapshot; skipped: ImportPreview['skipped'] }>
    >(endpoints.kg.imports(companyId, businessId), {
      format: 'CSV',
      content,
      periodYear,
      periodMonth,
    }),
  );
}

/** The blank statement to hand the business. Returned as text so the caller can offer it as a file. */
export async function fetchTemplate(companyId: string, businessId: string): Promise<string> {
  const { data } = await apiClient.get<string>(endpoints.kg.importTemplate(companyId, businessId), {
    responseType: 'text',
  });
  return data;
}

// ---- snapshots ------------------------------------------------------------------------------

export async function listSnapshots(companyId: string, businessId: string): Promise<Snapshot[]> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<Snapshot[]>>(
      endpoints.kg.snapshots(companyId, businessId),
    ),
  );
}

export async function lockSnapshot(
  companyId: string,
  businessId: string,
  id: string,
): Promise<Snapshot> {
  return unwrap(
    await apiClient.post<ApiSuccessResponse<Snapshot>>(
      endpoints.kg.lockSnapshot(companyId, businessId, id),
      {},
    ),
  );
}

// ---- portfolio ------------------------------------------------------------------------------

export async function getRanking(
  companyId: string,
  periodYear: number,
  periodMonth: number,
): Promise<PortfolioView> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<PortfolioView>>(
      endpoints.kg.ranking(companyId, periodYear, periodMonth),
    ),
  );
}

export async function getPartnerStatement(
  companyId: string,
  partnerId: string,
  periodYear: number,
  periodMonth: number,
): Promise<PartnerStatement> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<PartnerStatement>>(
      endpoints.kg.partnerStatement(companyId, partnerId, periodYear, periodMonth),
    ),
  );
}

export async function getForecast(
  companyId: string,
  businessId: string,
): Promise<ForecastResult[]> {
  return unwrap(
    await apiClient.get<ApiSuccessResponse<ForecastResult[]>>(
      endpoints.kg.forecast(companyId, businessId),
    ),
  );
}
