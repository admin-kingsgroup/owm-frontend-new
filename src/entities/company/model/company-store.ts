import { create } from 'zustand';

import { getErrorMessage } from '@/shared/lib';

import { listCompanies } from '../api/company-api';
import type { Company } from './types';

/**
 * The company list, held once for everyone who needs it.
 *
 * Three places wanted this list — the companies page, the topbar switcher, and the group overview
 * that the API already derives it from — so it was being fetched up to three times a session, and
 * a company created in one place stayed invisible to the others until a reload. Holding it here
 * gives one request and one truth: `upsert` is what lets the create and edit flows publish a
 * change the switcher picks up immediately.
 *
 * It lives under `entities/company` rather than `shared/stores` because it is domain state, not a
 * cross-cutting application concern.
 */
interface CompanyState {
  companies: Company[] | null;
  /** Distinct from `companies === null`: a failed load is settled but has no data. */
  loaded: boolean;
  error: string | null;
  loading: boolean;
  /** Fetches once. Pass `force` after a change that the server owns. */
  load: (force?: boolean) => Promise<void>;
  /** Adds or replaces one company, so every reader sees the change without refetching. */
  upsert: (company: Company) => void;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: null,
  loaded: false,
  error: null,
  loading: false,

  load: async (force = false) => {
    const { loaded, loading } = get();
    if (loading) return;
    if (loaded && !force) return;

    set({ loading: true, error: null });
    try {
      set({ companies: await listCompanies(), loaded: true, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err, 'Could not load companies'), loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  upsert: (company) =>
    set((state) => {
      const current = state.companies ?? [];
      const exists = current.some((entry) => entry.id === company.id);
      return {
        companies: exists
          ? current.map((entry) => (entry.id === company.id ? company : entry))
          : [...current, company].sort((a, b) => a.name.localeCompare(b.name)),
        loaded: true,
      };
    }),
}));
