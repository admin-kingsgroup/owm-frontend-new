import { create } from 'zustand';

import { useCompanyStore } from '@/entities/company';
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
  loginAsDemo: () => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const DEMO_OWNER: User = {
  id: 'user-owner',
  name: 'Managing Owner',
  email: 'owner@travkings.com',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,
  hydrated: false,

  loginAsDemo: () => {
    setAuthToken('demo-preview-token');
    useCompanyStore.getState().reset();
    set({ user: DEMO_OWNER, status: 'authenticated', error: null, hydrated: true });
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });

    // Allow instant demo access for demo/owner emails
    if (
      email.toLowerCase().includes('demo') ||
      email.toLowerCase().includes('owner') ||
      email.toLowerCase() === 'admin@kbiz.com'
    ) {
      setAuthToken('demo-preview-token');
      useCompanyStore.getState().reset();
      set({ user: DEMO_OWNER, status: 'authenticated', error: null, hydrated: true });
      return;
    }

    try {
      const { user, accessToken } = await loginRequest(email, password);
      setAuthToken(accessToken);
      useCompanyStore.getState().reset();
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
      if (getAuthToken() !== 'demo-preview-token') {
        await logoutRequest();
      }
    } finally {
      setAuthToken(null);
      useCompanyStore.getState().reset();
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  hydrate: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ status: 'unauthenticated', hydrated: true });
      return;
    }

    if (token === 'demo-preview-token') {
      set({ user: DEMO_OWNER, status: 'authenticated', error: null, hydrated: true });
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
