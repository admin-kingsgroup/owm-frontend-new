import { useSyncExternalStore } from 'react';

/**
 * The theme preference, and the three states the stylesheet is built around.
 *
 * `system` stamps no attribute at all, which is what lets the `prefers-color-scheme` block in
 * globals.css apply. `light` and `dark` stamp `data-theme` so an explicit choice beats the OS in
 * both directions.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Shared with the pre-paint script in index.html — change both together or the page flashes. */
export const THEME_STORAGE_KEY = 'owm.theme';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    // Private browsing can throw on access rather than return null.
    return 'system';
  }
}

function apply(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
}

/**
 * Kept in a module-level store rather than component state so every mounted control shows the same
 * value. The source of truth is localStorage plus one attribute on <html>, both outside React,
 * which is exactly what useSyncExternalStore exists for.
 */
let current: ThemePreference = typeof document === 'undefined' ? 'system' : readStored();
const listeners = new Set<() => void>();

// The pre-paint script in index.html normally stamps the attribute before this module loads. This
// re-asserts it from the same stored value, so that if the script is ever removed the control and
// the page cannot disagree — the toggle would otherwise read "Dark" over a light page.
if (typeof document !== 'undefined') {
  apply(current);
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): ThemePreference {
  return current;
}

export function setTheme(preference: ThemePreference): void {
  if (preference === current) return;

  current = preference;
  apply(preference);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A theme that cannot be remembered is still worth applying for this session.
  }

  listeners.forEach((listener) => listener());
}

export function useTheme(): ThemePreference {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'system' as ThemePreference);
}
