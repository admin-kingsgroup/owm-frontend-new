import type { Business, Branch } from '../model/types';

/**
 * Downloads a text/csv file with UTF-8 BOM so Excel opens it without encoding glitches.
 */
export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads the full Business Portfolio Excel/CSV report.
 */
export function exportBusinessReportCsv(businesses: Business[]) {
  const headers = [
    'Business Name',
    'Code',
    'Total Investment (INR)',
    'Revenue (INR)',
    'Expenses (INR)',
    'Net Profit/Loss (INR)',
    'ROI (%)',
    'Current Valuation (INR)',
    'Branches Count',
    'Partners Count',
    'Status',
  ];

  const rows = businesses.map((b) => [
    `"${b.name}"`,
    b.code,
    b.investment,
    b.revenue,
    b.expenses,
    b.profit,
    `${b.roi.toFixed(1)}%`,
    b.currentValue,
    b.branchesCount,
    b.partnersCount,
    b.status,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const filename = `Business_Portfolio_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, csvContent);
}

/**
 * Generates and downloads the Travkings Branch Analytics Excel/CSV report.
 */
export function exportBranchReportCsv(branches: Branch[]) {
  const headers = [
    'Branch',
    'Investment (INR)',
    'Revenue (INR)',
    'Expenses (INR)',
    'Net Profit/Loss (INR)',
    'ROI (%)',
    'Profit Margin (%)',
    'Growth (%)',
    'Partner Share Each (INR)',
    'Status',
  ];

  const rows = branches.map((br) => {
    const partnerShare = br.profit / 4;
    return [
      br.name,
      br.investment,
      br.revenue,
      br.expenses,
      br.profit,
      `${br.roi.toFixed(1)}%`,
      `${br.profitMargin.toFixed(1)}%`,
      `${br.growthPercent.toFixed(1)}%`,
      partnerShare,
      br.status,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const filename = `Travkings_Branch_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, csvContent);
}

/**
 * Generates and downloads the Partner Profit Distribution Excel/CSV report.
 */
export function exportPartnerDistributionCsv(businesses: Business[]) {
  const headers = [
    'Business Name',
    'Total Business Profit (INR)',
    'Partner Name',
    'Ownership Share (%)',
    'Distributed Profit (INR)',
    'Status',
  ];

  const rows: string[][] = [];

  for (const b of businesses) {
    for (const p of b.partners) {
      rows.push([
        `"${b.name}"`,
        String(b.profit),
        `"${p.name}"`,
        `${p.sharePercentage}%`,
        String(p.profitShare),
        b.profit >= 0 ? 'Profit' : 'Loss Share',
      ]);
    }
  }

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const filename = `Partner_Profit_Distribution_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(filename, csvContent);
}

/**
 * Triggers the browser print dialog for an executive PDF report.
 */
export function triggerExecutivePrint() {
  window.print();
}
