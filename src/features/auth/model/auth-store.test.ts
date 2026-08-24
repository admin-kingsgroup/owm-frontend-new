import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useCompanyStore } from '@/entities/company';
import type { Company } from '@/entities/company';

const loginRequest = vi.fn();
const logoutRequest = vi.fn();

vi.mock('../api/auth-api', () => ({
  login: (email: string, password: string) => loginRequest(email, password),
  logout: () => logoutRequest(),
  fetchCurrentUser: vi.fn(),
}));

const setAuthToken = vi.fn();
vi.mock('@/shared/lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib')>()),
  setAuthToken: (value: string | null) => setAuthToken(value),
  getAuthToken: () => null,
}));

const { useAuthStore } = await import('./auth-store');

const company = (name: string): Company =>
  ({
    id: 'c1',
    name,
    code: 'ADBINR',
    type: 'PERSONAL',
    baseCurrency: 'INR',
    country: 'IN',
    status: 'ACTIVE',
    features: { billWiseDetails: false, multiCurrency: false },
  }) as unknown as Company;

/** As it stands after somebody has used the tab: the list read, and remembered. */
function asIfSomebodyHadBeenHere(name = "The previous person's company") {
  useCompanyStore.setState({
    companies: [company(name)],
    loaded: true,
    error: null,
    loading: false,
  });
}

/**
 * Whose companies the tab is holding.
 *
 * This store outlives a sign-out — nothing reloads the page — and it answers `load` from memory
 * once it has been read. So the question is not whether the list is correct while one person is
 * signed in, but what happens to it when the person changes. The answer has to be "nothing of
 * theirs is left", because the list is names and codes belonging to somebody else, and the
 * switcher that draws it is on every screen in the product.
 */
describe('the company list across a change of user', () => {
  beforeEach(() => {
    loginRequest.mockReset();
    logoutRequest.mockReset();
    setAuthToken.mockReset();
    useCompanyStore.getState().reset();
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  afterEach(() => {
    useCompanyStore.getState().reset();
  });

  it('is emptied when somebody signs in', async () => {
    asIfSomebodyHadBeenHere();
    loginRequest.mockResolvedValue({ user: { id: 'u2', name: 'Second' }, accessToken: 'token-2' });

    await useAuthStore.getState().login('second@owm.local', 'secret');

    /*
      Both, not just the array. Leaving `loaded` true would empty the list and then refuse to read
      it again — a switcher that is permanently blank rather than one showing the wrong names, which
      is a different bug rather than a fix.
    */
    expect(useCompanyStore.getState().companies).toBeNull();
    expect(useCompanyStore.getState().loaded).toBe(false);
  });

  it('is emptied when somebody signs out', async () => {
    asIfSomebodyHadBeenHere();
    logoutRequest.mockResolvedValue(undefined);

    await useAuthStore.getState().logout();

    expect(useCompanyStore.getState().companies).toBeNull();
    expect(useCompanyStore.getState().loaded).toBe(false);
  });

  it('is emptied even when the sign-out call itself fails', async () => {
    // The server refusing to hear about it does not mean this tab is still that person's.
    asIfSomebodyHadBeenHere();
    logoutRequest.mockRejectedValue(new Error('network'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow('network');

    expect(useCompanyStore.getState().companies).toBeNull();
  });

  it('leaves the list alone when a sign-in is refused', async () => {
    /*
      A failed sign-in is not a change of user. Emptying here would log somebody out of their own
      list because a colleague mistyped a password at their desk.
    */
    asIfSomebodyHadBeenHere('Still mine');
    loginRequest.mockRejectedValue(new Error('Invalid email or password'));

    await expect(useAuthStore.getState().login('wrong@owm.local', 'nope')).rejects.toThrow();

    expect(useCompanyStore.getState().companies?.[0]?.name).toBe('Still mine');
  });

  it('reads the list again for the next person rather than answering from memory', async () => {
    asIfSomebodyHadBeenHere();
    loginRequest.mockResolvedValue({ user: { id: 'u2', name: 'Second' }, accessToken: 'token-2' });

    await useAuthStore.getState().login('second@owm.local', 'secret');

    // `load` returns early while `loaded` holds, which is exactly what made the stale list stick.
    expect(useCompanyStore.getState().loaded).toBe(false);
  });
});
