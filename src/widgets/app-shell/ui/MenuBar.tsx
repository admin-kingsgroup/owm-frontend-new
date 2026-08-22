import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/shared/lib';
import { useMenuKeys } from '@/shared/hooks';

import { hasOpenDialog } from '../model/button-bar';
import type { Menu } from '../model/menus';
import styles from './MenuBar.module.css';

interface MenuBarProps {
  menus: Menu[];
  /**
   * Closes the drawer the bar sits in below 60rem. Above it the bar is part of the page and this
   * does nothing — the menu closing after a choice is handled here either way.
   */
  onNavigate?: () => void;
}

/**
 * The classic menu bar: every destination in the product behind six words, each opened by its
 * underlined letter.
 *
 * Alt + the mnemonic opens a menu from anywhere, Left and Right walk between them once one is open,
 * Up and Down walk the items (shared with the user menu — see useMenuKeys), and Escape closes.
 * Moving the pointer across the bar with a menu open switches menus without a second click, which
 * is what makes a menu bar quicker to read than a set of separate dropdowns.
 */
export function MenuBar({ menus, onNavigate }: MenuBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const location = useLocation();

  /**
   * Which menu is open, and where the app was when it was opened.
   *
   * Tying the two together is what closes the bar on any navigation — including one made from
   * somewhere else entirely, such as the back button, which would otherwise leave a menu hanging
   * over the screen it just left. Derived rather than reset from an effect: an effect would render
   * the stale menu once before taking it away again.
   */
  const [opened, setOpened] = useState<{ id: string; at: string } | null>(null);
  const openId = opened && opened.at === location.key ? opened.id : null;

  const setOpenId = useCallback(
    (next: string | null | ((current: string | null) => string | null)) => {
      setOpened((previous) => {
        const current = previous && previous.at === location.key ? previous.id : null;
        const resolved = typeof next === 'function' ? next(current) : next;
        return resolved === null ? null : { id: resolved, at: location.key };
      });
    },
    [location.key],
  );

  useMenuKeys(openId !== null, menuRef);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpenId(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && openId !== null) {
        /*
          Focus goes back to the trigger, not to nowhere. Closing the menu takes the focused item
          out of the DOM, and focus then falls to <body> — leaving anyone on the keyboard at the
          top of the page with no idea where they were. Read before the state change, while the
          open trigger still carries the attribute.
        */
        const trigger = barRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]');
        setOpenId(null);
        trigger?.focus();
        return;
      }

      // Alt+letter opens a menu from anywhere in the app, which is the whole point of a mnemonic —
      // except from under a dialog, which owns the keyboard until it is closed.
      if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !hasOpenDialog()) {
        const target = menus.find((menu) => event.code === `Key${menu.mnemonic}`);
        if (target) {
          event.preventDefault();
          setOpenId((current) => (current === target.id ? null : target.id));
        }
        return;
      }

      if (openId === null) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      const index = menus.findIndex((menu) => menu.id === openId);
      if (index === -1) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : menus.length - 1;
      setOpenId(menus[(index + step) % menus.length].id);
    }

    /*
      Firefox opens its own menu bar on the Alt *keyup*, not the keydown — so suppressing Alt+R on
      keydown still left the browser's File/Edit/View strip dropping over the app a moment later.
      Swallowing the matching keyup is what stops that, and it is scoped to the combinations the
      product actually claims: a plain Alt press is left alone.
    */
    function handleKeyUp(event: KeyboardEvent) {
      if (!event.altKey && event.key !== 'Alt') return;
      if (menus.some((menu) => event.code === `Key${menu.mnemonic}`)) event.preventDefault();
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [menus, openId, setOpenId]);

  return (
    <div className={styles.bar} ref={barRef}>
      {menus.map((menu) => {
        const open = openId === menu.id;
        const menuId = `${idPrefix}-${menu.id}`;

        return (
          <div className={styles.slot} key={menu.id}>
            <button
              type="button"
              className={cn(styles.trigger, open && styles.triggerOpen)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => setOpenId(open ? null : menu.id)}
              // Classic menu-bar behaviour: once one is open the bar tracks the pointer.
              onMouseEnter={() => setOpenId((current) => (current === null ? null : menu.id))}
            >
              <u className={styles.mnemonic}>{menu.label.charAt(0)}</u>
              {menu.label.slice(1)}
            </button>

            {open && (
              <div className={styles.menu} role="menu" id={menuId} ref={menuRef}>
                {menu.items.map((item) => {
                  /*
                    Matched on the whole location, query included. NavLink's own `isActive` reads
                    the path alone, which would light up all nine reports at once — they differ
                    only by ?report=. Exact means one item can be current, never two.
                  */
                  const current = `${location.pathname}${location.search}` === item.to;

                  return (
                    /*
                      role="none" because a menu may only contain menu items: a bare wrapper div
                      inside role="menu" leaves a screen reader announcing a menu whose items it
                      cannot count. The heading below is exposed as the item's own text instead.
                    */
                    <div role="none" key={item.to + item.label}>
                      {item.section && <span className={styles.section}>{item.section}</span>}
                      <Link
                        to={item.to}
                        role="menuitem"
                        className={cn(styles.item, current && styles.itemActive)}
                        aria-current={current ? 'true' : undefined}
                        onClick={() => {
                          setOpenId(null);
                          onNavigate?.();
                        }}
                      >
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.hint && <span className={styles.hint}>{item.hint}</span>}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
