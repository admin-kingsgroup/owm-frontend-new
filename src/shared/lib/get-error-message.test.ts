import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';

import { getErrorMessage, getErrorStatus } from './get-error-message';

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

  it('says which field was rejected, not just that something was', () => {
    // The server had already said what was wrong; "Validation failed" throws that away.
    expect(
      getErrorMessage(
        axiosErrorWith(
          {
            message: 'Validation failed',
            errors: [{ message: 'gstin is not a valid GSTIN', path: ['body', 'gstin'] }],
          },
          422,
        ),
      ),
    ).toBe('gstin is not a valid GSTIN');
  });

  it('joins a few rejected fields and counts the rest', () => {
    const errors = ['a is wrong', 'b is wrong', 'c is wrong', 'd is wrong'].map((message) => ({
      message,
    }));

    expect(getErrorMessage(axiosErrorWith({ message: 'Validation failed', errors }, 422))).toBe(
      'a is wrong · b is wrong · c is wrong · and 1 more',
    );
  });

  it('keeps the plain message when nothing was rejected field by field', () => {
    // Every failure that is not a validation carries an empty `errors`, and its message is the
    // whole of what there is to say.
    expect(
      getErrorMessage(axiosErrorWith({ message: 'Ledger has existing entries', errors: [] })),
    ).toBe('Ledger has existing entries');
  });

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

/**
 * Told apart because the words differ. The reported-errors list showed "these are not yours to
 * read" over a dropped connection, which sends somebody to ask for permission they already hold.
 */
describe('getErrorStatus', () => {
  const axiosErrorWith = (status: number) => {
    const error = new AxiosError('Request failed');
    error.response = {
      data: {},
      status,
      statusText: '',
      headers: {},
      config: { headers: {} } as never,
    };
    return error;
  };

  it('reports the status a refusal came back with', () => {
    expect(getErrorStatus(axiosErrorWith(403))).toBe(403);
    expect(getErrorStatus(axiosErrorWith(401))).toBe(401);
  });

  it('separates a server fault from a refusal', () => {
    expect(getErrorStatus(axiosErrorWith(500))).toBe(500);
  });

  it('says nothing when the request never got a response', () => {
    // Offline, blocked, or the server is down — which is not a refusal either.
    expect(getErrorStatus(new AxiosError('Network Error'))).toBeUndefined();
  });

  it('says nothing for a failure that did not come from the API at all', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined();
    expect(getErrorStatus('boom')).toBeUndefined();
  });
});
