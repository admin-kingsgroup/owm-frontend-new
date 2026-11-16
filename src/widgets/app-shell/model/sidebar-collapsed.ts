/**
 * Whether the person has folded the sidebar down to its icons, remembered across visits.
 *
 * Reached through `window` for the same reason as the theme (see use-theme): under Node 26 a
 * built-in `localStorage` shadows jsdom's and throws. Private browsing can throw too, so a failed
 * read means "not collapsed" and a failed write is simply not remembered.
 */
export const SIDEBAR_COLLAPSED_KEY = 'owm.sidebarCollapsed';

export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not remembered; the rail still folds for this visit.
  }
}
