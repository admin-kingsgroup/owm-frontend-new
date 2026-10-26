import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAuthToken, getRefreshToken, setAuthToken, setRefreshToken } from '@/shared/lib';

import { apiClient, onSessionExpired } from './client';

/**
 * A stand-in server: one access token it accepts, and refresh tokens it will trade once each.
 * Plugged in as axios adapters, so the real interceptors run against it unchanged.
 */
function fakeServer({
  refreshAnswer = 'ok',
}: { refreshAnswer?: 'ok' | 'refused' | 'offline' } = {}) {
  let validAccess = 'access-2';
  const refreshCalls: string[] = [];

  const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
    const response = { status, statusText: '', data, headers: {}, config };
    if (status >= 400) {
      throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  };

  apiClient.defaults.adapter = async (config) => {
    const header = AxiosHeaders.from(config.headers).get('Authorization');
    if (config.url?.startsWith('/auth/login')) {
      return respond(config, 401, { message: 'bad password' });
    }
    return header === `Bearer ${validAccess}`
      ? respond(config, 200, { data: { ok: true, url: config.url } })
      : respond(config, 401, { message: 'expired' });
  };

  axios.defaults.adapter = async (config) => {
    const { refreshToken } = JSON.parse(String(config.data));
    refreshCalls.push(refreshToken);
    if (refreshAnswer === 'offline') throw new AxiosError('down', 'ERR_NETWORK', config);
    if (refreshAnswer === 'refused') return respond(config, 401, { message: 'already used' });
    validAccess = `access-${refreshCalls.length + 2}`;
    return respond(config, 200, {
      data: { accessToken: validAccess, refreshToken: `refresh-${refreshCalls.length + 1}` },
    });
  };

  return { refreshCalls };
}

describe('the API client renewing an expired session', () => {
  const expired = vi.fn();

  beforeEach(() => {
    setAuthToken('access-1');
    setRefreshToken('refresh-1');
    expired.mockReset();
    onSessionExpired(expired);
  });

  afterEach(() => {
    onSessionExpired(null);
    setAuthToken(null);
    setRefreshToken(null);
  });

  it('refreshes once on a 401, keeps the new pair, and retries the request', async () => {
    const server = fakeServer();

    const { data } = await apiClient.get('/companies');

    expect(data.data.ok).toBe(true);
    expect(server.refreshCalls).toEqual(['refresh-1']);
    expect(getAuthToken()).toBe('access-3');
    expect(getRefreshToken()).toBe('refresh-2');
    expect(expired).not.toHaveBeenCalled();
  });

  it('spends the refresh token once when several requests expire together', async () => {
    // Spending it once per request would present a spent token — which ends every session.
    const server = fakeServer();

    const results = await Promise.all([
      apiClient.get('/companies'),
      apiClient.get('/auth/me'),
      apiClient.get('/reports/group-overview'),
    ]);

    expect(results.every((result) => result.data.data.ok)).toBe(true);
    expect(server.refreshCalls).toHaveLength(1);
  });

  it('signs out when the server refuses the refresh', async () => {
    fakeServer({ refreshAnswer: 'refused' });

    await expect(apiClient.get('/companies')).rejects.toBeInstanceOf(AxiosError);

    expect(expired).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('keeps the session when the server cannot be reached to ask', async () => {
    // Being offline is not a verdict on the session; signing out for it would lose the person's place.
    fakeServer({ refreshAnswer: 'offline' });

    await expect(apiClient.get('/companies')).rejects.toBeInstanceOf(AxiosError);

    expect(expired).not.toHaveBeenCalled();
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('does not try to refresh a refused sign-in', async () => {
    const server = fakeServer();

    await expect(apiClient.post('/auth/login', {})).rejects.toBeInstanceOf(AxiosError);

    expect(server.refreshCalls).toHaveLength(0);
    expect(expired).not.toHaveBeenCalled();
  });
});
