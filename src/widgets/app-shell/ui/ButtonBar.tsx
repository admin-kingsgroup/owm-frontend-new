import { useId } from 'react';

import type { ButtonBarAction } from '../model/button-bar';
import styles from './ButtonBar.module.css';

interface ButtonBarProps {
  actions: ButtonBarAction[];
}

/**
 * The strip down the right-hand side: what this screen can do, and the key that does it.
 *
 * Every action is both a button and a printed shortcut, so the same bar serves someone reaching for
 * the mouse and someone learning the keyboard. Groups appear in the order they are first mentioned,
 * which lets a page order its own bar without having to declare the groups up front.
 */
export function ButtonBar({ actions }: ButtonBarProps) {
  const idPrefix = useId();

  /* Bound elsewhere on screen — see keyOnly. The bar draws what it owns, not every live binding. */
  const drawn = actions.filter((action) => !action.keyOnly);
  if (drawn.length === 0) return null;

  const groups: Array<{ name: string; actions: ButtonBarAction[] }> = [];
  for (const action of drawn) {
    const existing = groups.find((group) => group.name === action.group);
    if (existing) existing.actions.push(action);
    else groups.push({ name: action.group, actions: [action] });
  }

  return (
    <aside className={styles.bar} aria-label="Actions for this screen">
      {groups.map((group, index) => (
        /*
          A labelled group rather than a heading floating above some buttons: without the
          association, a screen reader reads eleven unrelated buttons instead of "Create: Payment,
          F5". The index keys the label because a group name is free text from the page.
        */
        <div
          className={styles.group}
          key={group.name}
          role="group"
          aria-labelledby={`${idPrefix}-${index}`}
        >
          <span className={styles.groupName} id={`${idPrefix}-${index}`}>
            {group.name}
          </span>
          {group.actions.map((action) => (
            <button
              type="button"
              key={`${group.name}/${action.key}/${action.label}`}
              className={styles.action}
              onClick={action.onSelect}
              disabled={action.disabled}
              /* The label ellipsises in a 13rem column; the full wording stays reachable. */
              title={action.label}
            >
              <span className={styles.label}>{action.label}</span>
              <kbd className={styles.key}>{action.key}</kbd>
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
