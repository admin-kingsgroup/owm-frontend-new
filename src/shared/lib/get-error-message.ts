import { isAxiosError } from 'axios';

/**
 * The message to show a user for a failure.
 *
 * The API sends a reason worth reading — "Cannot move 2026-2027: 3 existing vouchers would fall
 * outside it" — and that is always preferred. It is checked for being a string first: a body whose
 * `message` is an object or an array would otherwise be handed straight to React, which renders it
 * as "[object Object]" or throws outright.
 *
 * When the server responded but said nothing useful, the caller's fallback wins over Axios's own
 * "Request failed with status code 500", which tells the user nothing they can act on. A failure
 * with no response at all is different — "Network Error" is the most accurate thing anyone can say
 * about it, so that message is kept.
 */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    return error.response ? fallback : error.message || fallback;
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
