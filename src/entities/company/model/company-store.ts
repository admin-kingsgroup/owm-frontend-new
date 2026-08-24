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
  /**
   * Empties the list and forgets that it was ever read.
   *
   * Called when the signed-in user changes. This store outlives a sign-out — nothing reloads the
   * page — and `load` returns early once it has answered, so without this the next person to sign
   * in on the same tab is shown the previous person's companies: their names and their codes, in
   * the switcher at the top of every screen and on the selection list itself. It is the one piece
   * of state here that belongs to a person rather than to the installation.
   */
  reset: () => void;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: null,
  loaded: false,
  error: null,
  loading: false,

  load: async (force = false) => {
    const { loaded, loading, error } = get();
    if (loading) return;
    // A load that failed is settled but has nothing to show, so the next caller is allowed to try
    // again. Without the `!error` the first failure stuck for the session: the shell would go on
    // calling load() and returning early, leaving the switcher hidden until a full reload.
    if (loaded && !error && !force) return;

    set({ loading: true, error: null });
    try {
      set({ companies: await listCompanies(), loaded: true, error: null });
    } catch (err) {
      set({ error: getErrorMessage(err, 'Could not load companies'), loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ companies: null, loaded: false, error: null, loading: false }),

  upsert: (company) =>
    set((state) => {
      const current = state.companies ?? [];
      const exists = current.some((entry) => entry.id === company.id);
      const next = exists
        ? current.map((entry) => (entry.id === company.id ? company : entry))
        : [...current, company];

      // Sorted on every write, not only on insert. Sorting the insert alone left a renamed company
      // sitting in its old slot until the next reload, which reads as the rename not having taken.
      return { companies: next.sort((a, b) => a.name.localeCompare(b.name)), loaded: true };
    }),
}));
