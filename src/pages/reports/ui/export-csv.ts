import type { ReportNode } from '@/entities/report';

/*
  The CSV primitives moved to shared/lib when the company screen started exchanging masters too —
  one implementation of the escaping, which is the part that silently corrupts a file. Re-exported
  here so the reports keep importing them from where they always did.
*/
export { toCsv, downloadCsv } from '@/shared/lib';

/**
 * Flattens a report tree into indented rows, preserving the nesting a statement is read by.
 *
 * With `withPrior` each row gains the comparison year's figure as a final column. Figures stay raw
 * decimals throughout — a spreadsheet needs a number, and a grouped, symbol-prefixed string imports
 * as text and stops summing.
 */
export function flattenNodes(nodes: ReportNode[], depth = 0, withPrior = false): string[][] {
  return nodes.flatMap((node) => [
    [
      `${'    '.repeat(depth)}${node.name}`,
      node.code,
      node.kind,
      node.debit,
      node.credit,
      node.balance,
      node.balanceSide,
      // Empty, not "0.00": the prior year had no such row, which is not the same as a zero balance.
      ...(withPrior ? [node.priorBalance ?? ''] : []),
    ],
    ...(node.children ? flattenNodes(node.children, depth + 1, withPrior) : []),
  ]);
}
