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
 *
 * Data entry is the exception, and is pinned to the top. It is the commonest thing anyone does and
 * Tally puts it there — but it cannot simply be listed first, because the order of `actions` is
 * also the order shortcuts are matched in, and a page has to be able to bind F8 to its own meaning
 * without the shell's Sales key answering first. So the page keeps precedence and the bar decides
 * where things are drawn.
 */
const PINNED_FIRST = 'Data entry';
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

  const pinned = groups.findIndex((group) => group.name === PINNED_FIRST);
  if (pinned > 0) groups.unshift(...groups.splice(pinned, 1));

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
          {group.actions.map((action, position) => (
            <button
              type="button"
              /*
                Positional, because nothing in an action is reliably unique any more: a voucher type
                the company invented has no key, and only its *code* is unique per company — two of
                them may legitimately be named the same. Keying on the label collided the moment
                they were, which React resolves by reusing the wrong button.
              */
              key={`${group.name}/${position}`}
              className={styles.action}
              onClick={action.onSelect}
              disabled={action.disabled}
              /* The label ellipsises in a 13rem column; the full wording stays reachable. */
              title={action.label}
            >
              <span className={styles.label}>{action.label}</span>
              {/*
                An action without a key still holds the key column, so the labels beside it stay on
                the same pixel as every other label in the strip — which is the whole reason the
                column is a fixed width. Empty and hidden rather than absent: read aloud it would
                otherwise be an unexplained pause between the label and the next action.
              */}
              {action.key ? (
                <kbd className={styles.key}>{action.key}</kbd>
              ) : (
                <span className={styles.key} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
