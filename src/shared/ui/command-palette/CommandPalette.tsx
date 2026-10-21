import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Search } from 'lucide-react';

import { useFocusTrap } from '@/shared/hooks';
import { cn } from '@/shared/lib';

import styles from './CommandPalette.module.css';

export interface CommandItem {
  /** Unique within the list. */
  id: string;
  /** The heading it is listed under — "Go to", "Reports", "Create". */
  group: string;
  label: string;
  /** Right-aligned beside the label: a key, a currency, a group name. */
  hint?: string;
  icon?: ReactNode;
  /** Extra words it should be found by that are not in its label. */
  keywords?: string;
  /**
   * The address it leads to, when it leads somewhere. Drawn as a real link then, so it can be
   * opened in a new tab or copied like any other — a plain click still runs `onSelect`.
   */
  href?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}

/** Every word typed has to appear somewhere in the item, in any order. */
function matches(item: CommandItem, query: string): boolean {
  const haystack =
    `${item.label} ${item.group} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * A search box over everything the product can reach, opened with Ctrl+K.
 *
 * The list is whatever the caller hands it, so the shell decides what is reachable — this only
 * filters, highlights and runs the choice. Arrow keys move, Enter runs, Escape closes. Announced as
 * a modal dialog, which is also what makes the shell's function keys stand down while it is open.
 */
export function CommandPalette({ open, ...rest }: CommandPaletteProps) {
  /* Mounted only while open, so every opening starts with an empty query at the top of the list. */
  return open ? <PaletteBody {...rest} /> : null;
}

function PaletteBody({
  onClose,
  items,
  placeholder = 'Search…',
}: Omit<CommandPaletteProps, 'open'>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useFocusTrap(true, panelRef);

  const shown = useMemo(
    () => (query.trim() ? items.filter((item) => matches(item, query)) : items).slice(0, 60),
    [items, query],
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  function run(item: CommandItem | undefined) {
    if (!item) return;
    onClose();
    item.onSelect();
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(shown.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(shown[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.field}>
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            className={styles.input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            aria-label={placeholder}
          />
          <kbd className={styles.esc}>Esc</kbd>
        </div>
        <ul className={styles.list} id={listId} role="listbox" ref={listRef}>
          {shown.length === 0 && <li className={styles.empty}>Nothing matches “{query}”.</li>}
          {shown.map((item, index) => {
            const heading =
              index === 0 || shown[index - 1].group !== item.group ? item.group : null;
            return (
              <li key={item.id} role="presentation">
                {heading && <div className={styles.group}>{heading}</div>}
                <a
                  id={`${listId}-${index}`}
                  data-index={index}
                  data-group={item.group}
                  role="option"
                  aria-selected={index === active}
                  href={item.href}
                  className={cn(styles.option, index === active && styles.active)}
                  onMouseMove={() => setActive(index)}
                  onClick={(event) => {
                    // A modified click opens the address the browser's own way — a new tab, a copy.
                    if (
                      item.href &&
                      (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
                    )
                      return;
                    event.preventDefault();
                    run(item);
                  }}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                  {item.hint && <span className={styles.hint}>{item.hint}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
