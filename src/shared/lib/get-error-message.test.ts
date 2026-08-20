import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';

import { getErrorMessage } from './get-error-message';

/**
 * Every screen shows failures through this. The server sends a reason worth reading — "Cannot move
 * 2026-2027: 3 existing vouchers would fall outside it" — and losing it in favour of a generic
 * fallback turns a fixable problem into a mystery.
 */
describe('getErrorMessage', () => {
  const axiosErrorWith = (data: unknown, status = 409) => {
    const error = new AxiosError('Request failed');
    error.response = {
      data,
      status,
      statusText: '',
      headers: {},
      config: { headers: {} } as never,
    };
    return error;
  };

  it('prefers the message the API sent', () => {
    expect(getErrorMessage(axiosErrorWith({ message: 'Company code "ABC" already exists' }))).toBe(
      'Company code "ABC" already exists',
    );
  });

  it('falls back when the API response carries no message', () => {
    expect(getErrorMessage(axiosErrorWith({ success: false }), 'Could not save')).toBe(
      'Could not save',
    );
  });

  it('keeps the message when there was no response at all', () => {
    // "Network Error" is the most accurate thing anyone can say about a request that never landed.
    expect(getErrorMessage(new AxiosError('Network Error'), 'Could not reach the server')).toBe(
      'Network Error',
    );
  });

  it('prefers the caller fallback over Axios status noise', () => {
    // "Request failed with status code 500" tells the user nothing they can act on.
    expect(getErrorMessage(axiosErrorWith({}, 500), 'Could not load reports')).toBe(
      'Could not load reports',
    );
  });

  it('ignores a blank message from the server', () => {
    expect(getErrorMessage(axiosErrorWith({ message: '   ' }), 'Could not save')).toBe(
      'Could not save',
    );
  });

  it('uses a plain Error message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back for something that is not an error at all', () => {
    expect(getErrorMessage('a string', 'Could not save')).toBe('Could not save');
    expect(getErrorMessage(null, 'Could not save')).toBe('Could not save');
    expect(getErrorMessage(undefined)).toBe('Something went wrong');
  });

  it('ignores a non-string message rather than rendering an object', () => {
    expect(getErrorMessage(axiosErrorWith({ message: { nested: true } }), 'Fallback')).toBe(
      'Fallback',
    );
  });
});
