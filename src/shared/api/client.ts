import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/shared/config';
import {
  getAuthToken,
  getRefreshToken,
  reloadAuthToken,
  setAuthToken,
  setRefreshToken,
} from '@/shared/lib';

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

/** Calls whose 401 is an answer about credentials, not an expired session to renew. */
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh-token', '/auth/logout'];

let sessionExpiredHandler: (() => void) | null = null;

/**
 * What to do once the session cannot be renewed. Registered by the auth feature, which owns what
 * "signed out" means; this layer only knows that it happened.
 */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

/**
 * Trades the refresh token for a new pair. Resolves to the new access token, or `null` when the
 * server refused — the session is over. Anything else (offline, server down) is not a verdict on
 * the session, so it rejects and the tokens are kept for the next attempt.
 *
 * Sent on a bare axios call, not `apiClient`, so a refusal here cannot loop back into the
 * interceptor below.
 */
async function refreshSession(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(
      `${env.apiBaseUrl}/auth/refresh-token`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const next = data?.data as { accessToken: string; refreshToken?: string };
    setAuthToken(next.accessToken);
    setRefreshToken(next.refreshToken ?? null);
    return next.accessToken;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) return null;
    throw error;
  }
}

/**
 * One refresh at a time. A screen opening fires several requests at once; when the access token
 * has expired they all come back 401 together, and each spending the refresh token would present a
 * spent one — which the server treats as theft and answers by ending every session.
 */
let refreshing: Promise<string | null> | null = null;

apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as
    (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

  if (
    error.response?.status !== 401 ||
    !original ||
    original._retried ||
    NO_REFRESH.some((path) => original.url?.startsWith(path))
  ) {
    throw error;
  }
  original._retried = true;

  // Another tab may have renewed the session already: use its token rather than spend ours.
  const sent = String(original.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const stored = reloadAuthToken();
  let token = stored && stored !== sent ? stored : null;

  if (!token) {
    refreshing ??= refreshSession().finally(() => {
      refreshing = null;
    });

    try {
      token = await refreshing;
    } catch {
      // Could not reach the server to ask. The session may be fine; this request is not.
      throw error;
    }
  }

  if (!token) {
    setAuthToken(null);
    setRefreshToken(null);
    sessionExpiredHandler?.();
    throw error;
  }

  original.headers.set('Authorization', `Bearer ${token}`);
  return apiClient(original);
});
