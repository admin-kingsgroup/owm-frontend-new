import { ChevronRight, Lock, Trash2 } from 'lucide-react';

import type { AccountGroup } from '@/entities/account-group';
import { cn } from '@/shared/lib';

import styles from './AccountGroupTree.module.css';

export interface AccountGroupTreeProps {
  groups: AccountGroup[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  onDelete: (group: AccountGroup) => void;
  deletingGroupId: string | null;
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
  onDelete,
  deletingGroupId,
}: {
  node: TreeNode;
  depth: number;
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  onDelete: (group: AccountGroup) => void;
  deletingGroupId: string | null;
}) {
  const isSelected = selectedGroupId === node.group.id;
  const { group } = node;

  return (
    <div>
      <div className={cn(styles.row, isSelected && styles.rowSelected)}>
        <button
          type="button"
          className={cn(styles.item, !group.isActive && styles.itemInactive)}
          style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
          onClick={() => onSelect(isSelected ? null : group.id)}
        >
          {node.children.length > 0 && <ChevronRight size={13} className={styles.chevron} />}
          <span className={styles.itemName} title={group.name}>
            {group.name}
          </span>
          {group.isSystem && <Lock size={12} className={styles.lock} aria-label="Standard group" />}
          <span className={styles.itemCode}>{group.code}</span>
        </button>
        <button
          type="button"
          className={styles.rowAction}
          disabled={group.isSystem || deletingGroupId === group.id}
          title={
            group.isSystem
              ? 'Standard groups cannot be deleted — deactivate it instead'
              : 'Delete group'
          }
          aria-label={`Delete ${group.name}`}
          onClick={() => onDelete(group)}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {node.children.map((child) => (
        <TreeItem
          key={child.group.id}
          node={child}
          depth={depth + 1}
          selectedGroupId={selectedGroupId}
          onSelect={onSelect}
          onDelete={onDelete}
          deletingGroupId={deletingGroupId}
        />
      ))}
    </div>
  );
}

export function AccountGroupTree({
  groups,
  selectedGroupId,
  onSelect,
  onDelete,
  deletingGroupId,
}: AccountGroupTreeProps) {
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
      {groups.length === 0 ? (
        <p className={styles.hint}>
          No account groups yet. Use <strong>New</strong> above to add the first one — ledgers hang
          off these.
        </p>
      ) : (
        tree.map((node) => (
          <TreeItem
            key={node.group.id}
            node={node}
            depth={0}
            selectedGroupId={selectedGroupId}
            onSelect={onSelect}
            onDelete={onDelete}
            deletingGroupId={deletingGroupId}
          />
        ))
      )}
    </div>
  );
}
