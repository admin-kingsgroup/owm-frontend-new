import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Arrow-key navigation for an open menu.
 *
 * A dropdown that can only be walked with Tab makes the reader traverse the whole page to leave
 * it, and gives no way to move between siblings — which is what anyone reaching for the keyboard
 * expects a menu to do. Up, Down, Home and End move focus; the first item takes focus when the
 * menu opens, so the keyboard lands somewhere useful.
 *
 * Shared by the user menu and the company switcher rather than written twice: two implementations
 * of the same interaction is how they drift apart.
 */
export function useMenuKeys(open: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;

    const itemsOf = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
        (item) => !item.hasAttribute('disabled'),
      );

    // Open with the current item under the cursor where there is one, otherwise the first.
    const items = itemsOf();
    const current = items.findIndex((item) => item.getAttribute('aria-current') === 'true');
    items[current === -1 ? 0 : current]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      const list = itemsOf();
      if (list.length === 0) return;

      const index = list.indexOf(document.activeElement as HTMLElement);
      let next: number | null = null;

      if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % list.length;
      else if (event.key === 'ArrowUp')
        next = index < 0 ? list.length - 1 : (index - 1 + list.length) % list.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = list.length - 1;

      if (next === null) return;

      // Otherwise Down scrolls the page out from under the menu.
      event.preventDefault();
      list[next]?.focus();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [open, containerRef]);
}
