/**
 * Escape on an open dropdown list closes the list — and only the list.
 *
 * The dropdowns use the browser's customisable select (see "Dropdown lists" in globals.css). Its
 * list is part of the page, so an Escape pressed to close it also reaches the page's own Escape
 * listeners first: the Modal, the bottom sheet, the menus. One key press closed the list and the
 * whole form behind it, throwing away whatever had been typed. The plain browser list never let
 * the key through, so this puts that back.
 *
 * Stopped at the window in the capture phase, before any of those listeners see it. Only
 * propagation is stopped — not the default action — so the browser still closes the list itself.
 */
export function installSelectEscapeGuard(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      if (isSelectOpen()) event.stopPropagation();
    },
    { capture: true },
  );
}

function isSelectOpen(): boolean {
  try {
    return document.querySelector('select:open') !== null;
  } catch {
    // A browser that does not know `:open` has no styled list, so nothing to guard.
    return false;
  }
}
