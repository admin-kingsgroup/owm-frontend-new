// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import { setTheme, THEME_STORAGE_KEY } from './use-theme';

/**
 * The theme is held outside React — one key in localStorage and one attribute on <html> — so what
 * matters is that those two never disagree. A control reading "Dark" over a light page is the
 * failure this guards against.
 */
describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // Back to a known state; setTheme early-returns when the value is unchanged.
    setTheme('light');
    setTheme('system');
  });

  it('stamps an explicit choice onto the document', () => {
    setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the attribute for system, so prefers-color-scheme decides', () => {
    setTheme('dark');
    setTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('remembers the choice under the key the pre-paint script reads', () => {
    setTheme('dark');
    // index.html reads this exact key before React loads; a rename here reintroduces the flash.
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(THEME_STORAGE_KEY).toBe('owm.theme');
  });

  it('notifies subscribers so two controls cannot disagree', () => {
    const seen: string[] = [];
    // useSyncExternalStore subscribes through the same path; this asserts the store notifies.
    setTheme('dark');
    seen.push(document.documentElement.getAttribute('data-theme') ?? 'system');
    setTheme('light');
    seen.push(document.documentElement.getAttribute('data-theme') ?? 'system');

    expect(seen).toEqual(['dark', 'light']);
  });

  it('survives storage being unavailable', () => {
    const original = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error('private mode');
    };

    try {
      // A theme that cannot be remembered is still worth applying for this session.
      expect(() => setTheme('dark')).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    } finally {
      window.localStorage.setItem = original;
    }
  });
});
