import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

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

  /**
   * Which menu the screen you are looking at belongs to.
   *
   * The bar said nothing about where you were — every menu looked alike whether you were on the
   * dashboard or three reports deep, so the one piece of navigation on screen at all times was
   * also the one that never told you your position.
   *
   * Two passes, because neither rule works alone. An exact match settles it where the menu names
   * the precise destination, query and all; failing that, the pathname alone catches a screen
   * reached with different parameters than the menu happens to link — a report opened for another
   * period is still the Reports section.
   *
   * The Help menu is left out of the second pass deliberately. Its one item is the current screen
   * plus `?help=shortcuts`, so its *pathname* matches wherever you happen to be standing, and it
   * would otherwise claim to be the current section on every screen in the product. Its exact
   * match still counts, which is right: the shortcut sheet is genuinely open then.
   *
   * At most one menu is marked. Two lighting up at once would say less than none.
   */
  const currentMenuId = useMemo(() => {
    const here = `${location.pathname}${location.search}`;
    const exact = menus.find((menu) => menu.items.some((item) => item.to === here));
    if (exact) return exact.id;

    const byPath = menus.find(
      (menu) =>
        menu.id !== 'help' &&
        menu.items.some((item) => item.to.split('?')[0] === location.pathname),
    );
    return byPath?.id ?? null;
  }, [menus, location.pathname, location.search]);

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
        const current = currentMenuId === menu.id;
        const menuId = `${idPrefix}-${menu.id}`;

        return (
          <div className={styles.slot} key={menu.id}>
            <button
              type="button"
              className={cn(
                styles.trigger,
                /* Where you are. Given up while this menu's own dropdown is open, which draws its
                   own attached surface and would otherwise be wearing two marks at once. */
                current && !open && styles.triggerCurrent,
                open && styles.triggerOpen,
              )}
              /*
                The label is one text node now, so this would compute correctly from the content
                on its own — it is kept explicit so that anything added to the trigger later cannot
                change what the control is called.

                It used to be load-bearing. The first letter was wrapped in `<u>` to mark the
                mnemonic, and `<u>R</u>eports` computes an accessible name of "R eports": an
                element boundary is a word boundary to an accessibility tree, so every menu was
                announced with its first letter read out separately. The same split later showed up
                on screen as "D ashboards" once the triggers became flex containers with a gap —
                the `<u>` and the rest of the word were two flex items, and the gap went between
                them. The underline is gone and the word is whole in both trees.

                Alt+D still opens this menu; the shortcut sheet lists every one of them — see
                ShortcutSheet, which builds its rows from `menu.mnemonic`.
              */
              aria-label={menu.label}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={open ? menuId : undefined}
              onClick={() => setOpenId(open ? null : menu.id)}
              // Classic menu-bar behaviour: once one is open the bar tracks the pointer.
              onMouseEnter={() => setOpenId((current) => (current === null ? null : menu.id))}
            >
              {/*
                Wrapped, and positioned, so it paints above the fill the trigger draws behind it —
                see .fill in the stylesheet, which is an absolutely positioned pseudo-element and
                would otherwise cover the word.
              */}
              <span className={styles.label}>{menu.label}</span>
              {/*
                Says the word opens something. Nothing on the bar did — a menu bar is only obvious
                to someone who already knows it is one, and on a touchscreen there is no hover to
                discover it with. Hidden from the accessibility tree: `aria-haspopup` on the button
                already says this, and said twice it is read out twice.
              */}
              <ChevronDown className={styles.chevron} size={13} aria-hidden="true" />
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
