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

/**
 * The access token as storage holds it now, refreshing the in-memory copy.
 *
 * Another tab sharing this storage may have refreshed the session since this tab last read it.
 * Before spending a refresh token of its own, a tab checks here — the token it needs may already
 * be waiting.
 */
export function reloadAuthToken(): string | null {
  // Only a token actually found replaces the copy in memory: where storage cannot be read at all,
  // reading "nothing" says nothing, and must not sign the tab out.
  const stored = read();
  if (stored) token = stored;
  return getAuthToken();
}

const REFRESH_STORAGE_KEY = 'owm_refresh_token';
/** Used only when storage is unavailable, so a session still survives for the life of the tab. */
let refreshFallback: string | null = null;

/**
 * The refresh token, read from storage every time rather than cached.
 *
 * Each one works once and every tab shares it, so a cached copy goes stale the moment any tab
 * refreshes — and presenting a spent token ends every session the user has.
 */
export function getRefreshToken(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem(REFRESH_STORAGE_KEY);
    if (stored !== undefined) return stored ?? null;
  } catch {
    // Falls through to the in-memory copy.
  }
  return refreshFallback;
}

export function setRefreshToken(next: string | null): void {
  refreshFallback = next;

  try {
    if (next) globalThis.localStorage?.setItem(REFRESH_STORAGE_KEY, next);
    else globalThis.localStorage?.removeItem(REFRESH_STORAGE_KEY);
  } catch {
    // Kept in memory only; see `refreshFallback`.
  }
}
