import type { ReportNode } from '@/entities/report';

/**
 * Serialises a table to CSV text. Separated from the download so the escaping — the part that can
 * silently corrupt a file — is testable without a DOM.
 *
 * Amounts are written exactly as the server sent them — they are decimal strings, and letting a
 * spreadsheet reparse a rounded number is how a trial balance stops totalling zero. Every field is
 * quoted and inner quotes doubled, so a ledger named `Smith "Bob" & Co, Ltd` survives the trip.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

/** Hands the serialised table to the browser as a download. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = toCsv(headers, rows);

  // The BOM is what makes Excel read it as UTF-8 rather than the local codepage, which otherwise
  // mangles a currency symbol or an accented ledger name.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Flattens a report tree into indented rows, preserving the nesting a statement is read by. */
export function flattenNodes(nodes: ReportNode[], depth = 0): string[][] {
  return nodes.flatMap((node) => [
    [
      `${'    '.repeat(depth)}${node.name}`,
      node.code,
      node.kind,
      node.debit,
      node.credit,
      node.balance,
      node.balanceSide,
    ],
    ...(node.children ? flattenNodes(node.children, depth + 1) : []),
  ]);
}
