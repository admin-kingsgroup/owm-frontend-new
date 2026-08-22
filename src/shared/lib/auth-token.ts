const STORAGE_KEY = 'owm_access_token';

/**
 * The bearer token, held in memory and mirrored to storage.
 *
 * `undefined` means "not read yet" — distinct from `null`, which means "read, and there is none".
 * Reading lazily rather than at import time matters more than it looks: this module sits behind the
 * `@/shared/lib` barrel, so touching `localStorage` while it loads made *any* import of that barrel
 * fail outside a browser. A CSV escaping test in the node environment has no business needing a
 * DOM, and it did.
 */
let token: string | null | undefined;

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Storage can be present and still throw — Safari in private browsing does exactly this.
    return null;
  }
}

export function getAuthToken(): string | null {
  if (token === undefined) token = read();
  return token;
}

export function setAuthToken(next: string | null): void {
  token = next;

  try {
    if (next) globalThis.localStorage?.setItem(STORAGE_KEY, next);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // The session still works for as long as the tab is open; it simply will not outlive it.
  }
}
