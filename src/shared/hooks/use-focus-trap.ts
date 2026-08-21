import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Holds keyboard focus inside an open overlay, and gives it back when the overlay closes.
 *
 * Without this, Tab walks straight out of a dialog and into the page behind it — which is still
 * there, still clickable to a screen reader, and now the thing being read out while a modal covers
 * it. Also locks page scroll: a sheet that scrolls the list underneath it instead of itself is the
 * single most obvious way an overlay feels broken on a phone.
 *
 * Shared by the modal and the navigation drawer rather than written twice.
 */
export function useFocusTrap(open: boolean, containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Somewhere useful rather than wherever the last click left it. The container itself is the
    // fallback for an overlay that has nothing focusable in it yet.
    (focusable()[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped since the overlay opened.
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      // Only if focus is still inside what is being torn down; otherwise something has moved on
      // deliberately and yanking it back would be the surprise.
      if (container.contains(document.activeElement)) {
        previouslyFocused?.focus();
      }
    };
  }, [open, containerRef]);
}
