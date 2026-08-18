import { ChevronRight } from 'lucide-react';

import type { AccountGroup } from '@/entities/account-group';
import { cn } from '@/shared/lib';

import styles from './AccountGroupTree.module.css';

export interface AccountGroupTreeProps {
  groups: AccountGroup[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
}

interface TreeNode {
  group: AccountGroup;
  children: TreeNode[];
}

function buildTree(groups: AccountGroup[]): TreeNode[] {
  const nodesById = new Map<string, TreeNode>(
    groups.map((group) => [group.id, { group, children: [] }]),
  );
  const roots: TreeNode[] = [];

  for (const group of groups) {
    const node = nodesById.get(group.id)!;
    const parent = group.parentId ? nodesById.get(group.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeItem({
  node,
  depth,
  selectedGroupId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
}) {
  const isSelected = selectedGroupId === node.group.id;

  return (
    <div>
      <button
        type="button"
        className={cn(styles.item, isSelected && styles.itemSelected)}
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
        onClick={() => onSelect(isSelected ? null : node.group.id)}
      >
        {node.children.length > 0 && <ChevronRight size={13} className={styles.chevron} />}
        <span className={styles.itemName} title={node.group.name}>
          {node.group.name}
        </span>
        <span className={styles.itemCode}>{node.group.code}</span>
      </button>
      {node.children.map((child) => (
        <TreeItem
          key={child.group.id}
          node={child}
          depth={depth + 1}
          selectedGroupId={selectedGroupId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function AccountGroupTree({ groups, selectedGroupId, onSelect }: AccountGroupTreeProps) {
  const tree = buildTree(groups);

  return (
    <div className={styles.tree}>
      <button
        type="button"
        className={cn(styles.item, selectedGroupId === null && styles.itemSelected)}
        onClick={() => onSelect(null)}
      >
        <span className={styles.itemName}>All groups</span>
      </button>
      {tree.map((node) => (
        <TreeItem
          key={node.group.id}
          node={node}
          depth={0}
          selectedGroupId={selectedGroupId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
