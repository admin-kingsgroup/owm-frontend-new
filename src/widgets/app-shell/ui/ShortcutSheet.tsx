import { Modal } from '@/shared/ui';

import type { ButtonBarAction } from '../model/button-bar';
import type { Menu } from '../model/menus';
import styles from './ShortcutSheet.module.css';

interface ShortcutSheetProps {
  open: boolean;
  onClose: () => void;
  /** The bar as it stands on the screen behind this sheet. */
  actions: ButtonBarAction[];
  menus: Menu[];
}

/**
 * Every key the product answers to, read off what is actually bound.
 *
 * Built from the live action list and the live menus rather than from a written-out table, so it
 * cannot drift: a screen that publishes a new action gets it documented here for free, and one that
 * withdraws an action stops advertising it. That matters more here than anywhere else — a shortcut
 * sheet that lies is worse than no sheet, because it is believed.
 */
export function ShortcutSheet({ open, onClose, actions, menus }: ShortcutSheetProps) {
  const groups: Array<{ name: string; rows: Array<{ key: string; label: string }> }> = [
    {
      name: 'Menus',
      rows: menus.map((menu) => ({ key: `Alt+${menu.mnemonic}`, label: menu.label })),
    },
  ];

  for (const action of actions) {
    const existing = groups.find((group) => group.name === action.group);
    const row = { key: action.key, label: action.label };
    if (existing) existing.rows.push(row);
    else groups.push({ name: action.group, rows: [row] });
  }

  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="wide">
      <div className={styles.sheet}>
        {groups.map((group) => (
          <section className={styles.group} key={group.name}>
            <h3 className={styles.groupName}>{group.name}</h3>
            <dl className={styles.rows}>
              {group.rows.map((row) => (
                <div className={styles.row} key={`${group.name}/${row.key}/${row.label}`}>
                  <dt className={styles.label}>{row.label}</dt>
                  <dd>
                    <kbd className={styles.key}>{row.key}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className={styles.note}>
        A key that ends in a letter stands aside while you are typing, so Ctrl+A still selects the
        text in a field. Function keys and Ctrl+Enter work wherever the cursor is. Nothing fires
        while a dialog — including this one — is open.
      </p>
    </Modal>
  );
}
