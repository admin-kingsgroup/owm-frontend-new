import { create } from 'zustand';

import type { User } from '@/entities/user';
import { getAuthToken, setAuthToken, getErrorMessage } from '@/shared/lib';

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
      const { user, accessToken } = await loginRequest(email, password);
      setAuthToken(accessToken);
      set({ user, status: 'authenticated', error: null });
    } catch (error) {
      setAuthToken(null);
      const message = getErrorMessage(error, 'Invalid email or password');
      set({ user: null, status: 'unauthenticated', error: message });
      throw error;
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } finally {
      setAuthToken(null);
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
      set({ user: null, status: 'unauthenticated', hydrated: true });
    }
  },
}));
