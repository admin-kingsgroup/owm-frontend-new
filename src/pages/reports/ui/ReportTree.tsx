import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ReportNode } from '@/entities/report';
import { cn } from '@/shared/lib';

import styles from './ReportsPage.module.css';

export interface ReportTreeProps {
  nodes: ReportNode[];
  onSelectLedger: (node: ReportNode) => void;
  /**
   * How to render an amount. Passed in rather than imported, so the tree stays presentational and
   * the page decides the currency and which region's digit grouping to use.
   */
  formatAmount: (value: string) => string;
  /**
   * Set when a comparison is in play. Each row then carries last year's figure ahead of this
   * year's, quieter, so the eye still lands on the current column first.
   */
  showPrior?: boolean;
}

/**
 * Groups start collapsed below the top level, the way a statement is normally read — totals first,
 * detail on demand. A ledger row is a button rather than text because every figure in a statement
 * is meant to be a way into the postings behind it.
 */
function TreeRow({
  node,
  depth,
  onSelectLedger,
  formatAmount,
  showPrior,
}: {
  node: ReportNode;
  depth: number;
  onSelectLedger: (node: ReportNode) => void;
  formatAmount: (value: string) => string;
  showPrior?: boolean;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = Boolean(node.children?.length);
  const indent = { paddingLeft: `${0.5 + depth * 1.125}rem` };

  if (node.kind === 'ledger') {
    return (
      <button
        type="button"
        className={cn(styles.treeRow, styles.treeLedger)}
        style={indent}
        onClick={() => onSelectLedger(node)}
        title={`Open ${node.name}`}
      >
        <span className={styles.treeName}>{node.name}</span>
        {showPrior && (
          <span className={styles.treePriorAmount}>
            {node.priorBalance === undefined ? '—' : formatAmount(node.priorBalance)}
          </span>
        )}
        <span className={styles.treeAmount}>
          {formatAmount(node.balance)}
          <span className={styles.treeSide}>{node.balanceSide === 'DEBIT' ? 'Dr' : 'Cr'}</span>
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(styles.treeRow, styles.treeGroup)}
        style={indent}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        <span className={styles.treeChevron}>
          {hasChildren ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </span>
        <span className={styles.treeName}>{node.name}</span>
        {showPrior && (
          <span className={styles.treePriorAmount}>
            {node.priorBalance === undefined ? '—' : formatAmount(node.priorBalance)}
          </span>
        )}
        <span className={styles.treeAmount}>
          {formatAmount(node.balance)}
          <span className={styles.treeSide}>{node.balanceSide === 'DEBIT' ? 'Dr' : 'Cr'}</span>
        </span>
      </button>
      {expanded &&
        node.children?.map((child) => (
          <TreeRow
            key={`${child.kind}-${child.id}`}
            node={child}
            depth={depth + 1}
            onSelectLedger={onSelectLedger}
            formatAmount={formatAmount}
            showPrior={showPrior}
          />
        ))}
    </>
  );
}

export function ReportTree({ nodes, onSelectLedger, formatAmount, showPrior }: ReportTreeProps) {
  if (nodes.length === 0) {
    return <p className={styles.empty}>Nothing posted in this period.</p>;
  }

  return (
    <div className={styles.tree}>
      {nodes.map((node) => (
        <TreeRow
          key={`${node.kind}-${node.id}`}
          node={node}
          depth={0}
          onSelectLedger={onSelectLedger}
          formatAmount={formatAmount}
          showPrior={showPrior}
        />
      ))}
    </div>
  );
}
