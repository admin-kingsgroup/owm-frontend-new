import { cn } from '@/shared/lib';

import styles from './Tabs.module.css';

export interface TabItem<Id extends string = string> {
  id: Id;
  label: string;
}

export interface TabsProps<Id extends string = string> {
  items: ReadonlyArray<TabItem<Id>>;
  value: Id;
  onChange: (id: Id) => void;
  /** Names the strip for anyone who cannot see which group of tabs this is. */
  label: string;
  className?: string;
}

/**
 * A row of tabs.
 *
 * Scrolls sideways rather than wrapping: seven tabs do not fit across a phone, and on two rows
 * they read as two groups that mean different things rather than one row of equals.
 *
 * Announced as a tablist, so the panel each one controls is reachable — the pages that had written
 * their own strip were rendering plain buttons, which say nothing about being a choice among
 * several.
 */
export function Tabs<Id extends string = string>({
  items,
  value,
  onChange,
  label,
  className,
}: TabsProps<Id>) {
  return (
    <div className={cn(styles.tabs, className)} role="tablist" aria-label={label}>
      {items.map((item) => {
        const selected = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            /* Only the selected tab is in the tab order; the arrow keys move within the strip. */
            tabIndex={selected ? 0 : -1}
            className={cn(styles.tab, selected && styles.active)}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (step === 0) return;
              event.preventDefault();
              const at = items.findIndex((entry) => entry.id === value);
              /* Wraps, so the strip has no dead end at either edge. */
              const next = items[(at + step + items.length) % items.length];
              onChange(next.id);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
