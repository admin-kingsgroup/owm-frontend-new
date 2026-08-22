import { env } from '@/shared/config';

import { getAuthToken } from './auth-token';

/*
  ARCHITECTURE.md puts business API calls in the entity or feature that owns them. This is not one:
  there is no client-error entity to model, nothing reads the records back, and the call has to
  work when the shared Axios client is itself what broke — which is why it uses plain fetch and
  lives with the other cross-cutting utilities instead.
*/

/**
 * How the fault reached us. `RENDER` is what an error boundary catches; the other two come from
 * the window handlers below, which cover what boundaries by definition cannot — throws from event
 * handlers and timers, and rejected promises nobody caught.
 */
export type ClientErrorKind = 'RENDER' | 'UNHANDLED_REJECTION' | 'UNCAUGHT';

export interface ClientErrorReport {
  kind: ClientErrorKind;
  error: unknown;
  componentStack?: string;
}

/** Matches the caps the server validates against; trimming here saves a rejected round trip. */
const LIMITS = { message: 1_000, stack: 8_000, componentStack: 8_000, url: 500 };

/**
 * A render loop can throw many times a second. The endpoint is rate limited anyway, but a browser
 * firing hundreds of requests at a screen that is already broken helps nobody.
 */
const MAX_REPORTS_PER_SESSION = 10;
const DUPLICATE_WINDOW_MS = 10_000;

let reportsSent = 0;
const recentlySeen = new Map<string, number>();

function uuid(): string {
  // Available in every secure context, which the app always is — the fallback is only so that a
  // missing API degrades to a usable reference rather than to no report at all.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

const trim = (value: string | undefined, max: number) => value?.slice(0, max);

/**
 * The company on screen, read from the path rather than from React. The reporter is called from
 * places that have no hooks — a window listener, a boundary that has already failed — and the URL
 * is the one piece of context available everywhere.
 */
function companyIdFromPath(): string | undefined {
  return window.location.pathname.match(/\/companies\/([a-f0-9]{24})/i)?.[1];
}

/**
 * Files a browser-side fault and returns the reference to show the person who hit it.
 *
 * Never throws and never awaits: whatever went wrong, a failure to *report* it is not something
 * the user can act on, and turning it into a second error would be the wrong trade. The reference
 * is minted here rather than by the server so it can be shown even when the report cannot be sent.
 */
export function reportClientError({ kind, error, componentStack }: ClientErrorReport): string {
  const reference = uuid();
  const { message, stack } = describe(error);

  // The only record when reporting is switched off or fails — keep it whatever else happens.
  console.error(`[${kind}] ${message}`, { reference, error, componentStack });

  const now = Date.now();
  const signature = `${kind}:${message}`;
  const lastSeen = recentlySeen.get(signature);

  if (reportsSent >= MAX_REPORTS_PER_SESSION) return reference;
  if (lastSeen !== undefined && now - lastSeen < DUPLICATE_WINDOW_MS) return reference;

  recentlySeen.set(signature, now);
  reportsSent += 1;

  const token = getAuthToken();

  // Plain fetch rather than the axios client: the client is itself a candidate for what broke, and
  // `keepalive` lets a report outlive the navigation that a fatal error usually triggers.
  void fetch(`${env.apiBaseUrl}/client-errors`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      reference,
      kind,
      message: trim(message, LIMITS.message),
      stack: trim(stack, LIMITS.stack),
      componentStack: trim(componentStack, LIMITS.componentStack),
      url: trim(window.location.href, LIMITS.url),
      companyId: companyIdFromPath(),
    }),
  }).catch(() => {
    // Offline, blocked, or the endpoint is the thing that is down. The console line above stands.
  });

  return reference;
}

/** Guards against a second install attaching a second set of listeners — see below. */
let installed = false;

/**
 * Installs the two handlers an error boundary can never replace. Called once from the composition
 * root, before the first render, so a throw during start-up is reported too.
 *
 * Idempotent, because a second set of listeners would file every fault twice and there is nothing
 * in a duplicate report worth having. One call is all the app makes, but a dev server re-executing
 * this module on hot reload would otherwise stack them up a pair at a time.
 */
export function installClientErrorReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError({ kind: 'UNHANDLED_REJECTION', error: event.reason });
  });

  window.addEventListener('error', (event) => {
    // Resource failures (a broken <img>, a chunk that 404s) also fire here but carry no Error;
    // they are a network problem, not a fault in the code, and belong in the network tab.
    if (event.error) {
      reportClientError({ kind: 'UNCAUGHT', error: event.error });
    }
  });
}
