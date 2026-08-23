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
    const body = error.response?.data as { message?: unknown; errors?: unknown } | undefined;

    /*
      A rejected field says more than the refusal does. The API answers a failed validation with
      "Validation failed" and the reasons in `errors`, so a form showing only the top-level message
      tells somebody their entry was refused without telling them which box or why — and the server
      had already said "gstin is not a valid GSTIN". `errors` is empty on every other kind of
      failure, so preferring it costs those nothing.
    */
    const reasons = Array.isArray(body?.errors)
      ? body.errors
          .map((entry) => (entry as { message?: unknown } | null)?.message)
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];

    if (reasons.length > 0) {
      // Three at most: a form posting a dozen bad fields would otherwise fill the screen.
      const shown = reasons.slice(0, 3).join(' · ');
      return reasons.length > 3 ? `${shown} · and ${reasons.length - 3} more` : shown;
    }

    const message = body?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    return error.response ? fallback : error.message || fallback;
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
}

/**
 * The HTTP status a failure came back with, when it came back with one at all.
 *
 * A screen that treats every failure the same tells the user the wrong thing about most of them:
 * the reported-errors list said "these are not yours to read" over a dropped connection, which
 * sends someone to ask for permission they already have. `undefined` means the request never got
 * a response — offline, blocked, or the server is down — which is not a refusal either.
 */
export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}
