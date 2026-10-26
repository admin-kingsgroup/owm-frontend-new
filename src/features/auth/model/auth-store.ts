import { create } from 'zustand';

import { useCompanyStore } from '@/entities/company';
import type { User } from '@/entities/user';
import { onSessionExpired } from '@/shared/api';
import {
  getAuthToken,
  setAuthToken,
  getRefreshToken,
  setRefreshToken,
  getErrorMessage,
} from '@/shared/lib';

import { login as loginRequest, logout as logoutRequest, fetchCurrentUser } from '../api/auth-api';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,
  hydrated: false,

  login: async (email, password) => {
    set({ status: 'loading', error: null });

    try {
      const { user, accessToken, refreshToken } = await loginRequest(email, password);
      setAuthToken(accessToken);
      setRefreshToken(refreshToken ?? null);
      /*
        Whoever was here before, their companies are not this person's to see. Cleared on the way
        in rather than only on the way out, because a session does not always end with a sign-out —
        a token can expire, or a tab can be left — and the list is fetched once and remembered.
      */
      useCompanyStore.getState().reset();
      set({ user, status: 'authenticated', error: null });
    } catch (error) {
      setAuthToken(null);
      setRefreshToken(null);
      const message = getErrorMessage(error, 'Invalid email or password');
      set({ user: null, status: 'unauthenticated', error: message });
      throw error;
    }
  },

  logout: async () => {
    try {
      await logoutRequest(getRefreshToken() ?? undefined);
    } finally {
      setAuthToken(null);
      setRefreshToken(null);
      useCompanyStore.getState().reset();
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  hydrate: async () => {
    if (!getAuthToken()) {
      set({ status: 'unauthenticated', hydrated: true });
      return;
    }

    set({ status: 'loading' });

    try {
      const user = await fetchCurrentUser();
      set({ user, status: 'authenticated', error: null, hydrated: true });
    } catch {
      setAuthToken(null);
      setRefreshToken(null);
      set({ user: null, status: 'unauthenticated', hydrated: true });
    }
  },
}));

/*
  The API client renews an expired access token on its own; this runs only when that fails — the
  refresh token expired, was revoked at sign-out elsewhere, or was spent by another copy. The
  person is sent to sign in again, with nothing of theirs left on screen.
*/
onSessionExpired(() => {
  useCompanyStore.getState().reset();
  useAuthStore.setState({
    user: null,
    status: 'unauthenticated',
    error: 'Your session has ended. Please sign in again.',
  });
});
