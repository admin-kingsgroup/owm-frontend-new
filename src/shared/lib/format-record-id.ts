export function formatRecordId(companyCode: string, typeAbbrev: string, code: string): string {
  return `${companyCode}/${typeAbbrev}/${code}`;
}
