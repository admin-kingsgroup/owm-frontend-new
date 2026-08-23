// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The error reporter is the one piece of the app that runs *after* something has already gone
 * wrong, so what matters is that it cannot make things worse: never throw, never flood, never
 * lose the reference the person on screen was given.
 *
 * It keeps its dedupe map and its session counter at module scope — that is what makes a render
 * loop cheap — so every case here imports a fresh copy rather than inheriting the last one's
 * counters.
 */
async function freshReporter() {
  vi.resetModules();
  return import('./report-client-error');
}

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

describe('client error reporting', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
    window.history.replaceState({}, '', '/companies/68a000000000000000000001/reports');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a reference and files the report', async () => {
    const { reportClientError } = await freshReporter();

    const reference = reportClientError({ kind: 'RENDER', error: new Error('boom') });

    expect(reference).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({
      reference,
      kind: 'RENDER',
      message: 'boom',
    });
  });

  it('sends the report even when the request cannot be made', async () => {
    // Offline, blocked, or the endpoint is the thing that is down. The caller still gets a
    // reference, because that is what the person on screen is being told to quote.
    fetchMock.mockRejectedValue(new Error('network down'));
    const { reportClientError } = await freshReporter();

    expect(() => reportClientError({ kind: 'UNCAUGHT', error: new Error('boom') })).not.toThrow();
  });

  it('carries the company on screen, read from the path', async () => {
    const { reportClientError } = await freshReporter();
    reportClientError({ kind: 'RENDER', error: new Error('boom') });

    expect(bodyOf(fetchMock.mock.calls[0]).companyId).toBe('68a000000000000000000001');
  });

  it('omits the company when the path has none', async () => {
    window.history.replaceState({}, '', '/companies');
    const { reportClientError } = await freshReporter();
    reportClientError({ kind: 'RENDER', error: new Error('boom') });

    expect(bodyOf(fetchMock.mock.calls[0]).companyId).toBeUndefined();
  });

  it('sends the bearer token only when there is one', async () => {
    const { reportClientError } = await freshReporter();
    reportClientError({ kind: 'RENDER', error: new Error('anonymous') });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('Authorization');

    window.localStorage.setItem('owm_access_token', 'a-token');
    const signedIn = await freshReporter();
    signedIn.reportClientError({ kind: 'RENDER', error: new Error('signed in') });
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer a-token',
    });
  });

  it('describes a throw that is not an Error at all', async () => {
    const { reportClientError } = await freshReporter();

    reportClientError({ kind: 'UNHANDLED_REJECTION', error: 'a bare string' });
    reportClientError({ kind: 'UNHANDLED_REJECTION', error: { code: 42 } });

    expect(bodyOf(fetchMock.mock.calls[0]).message).toBe('a bare string');
    expect(bodyOf(fetchMock.mock.calls[1]).message).toBe('{"code":42}');
  });

  it('survives a value that cannot be serialised', async () => {
    // A rejected promise can carry anything, including something with a cycle in it. Failing to
    // describe it must not become a second error on top of the first.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const { reportClientError } = await freshReporter();

    expect(() => reportClientError({ kind: 'UNHANDLED_REJECTION', error: circular })).not.toThrow();
    expect(bodyOf(fetchMock.mock.calls[0]).message).toBe('[object Object]');
  });

  it('falls back to the error name when the message is empty', async () => {
    const { reportClientError } = await freshReporter();
    reportClientError({ kind: 'RENDER', error: new TypeError('') });

    expect(bodyOf(fetchMock.mock.calls[0]).message).toBe('TypeError');
  });

  it('files a repeated fault once, and still hands back a reference each time', async () => {
    const { reportClientError } = await freshReporter();

    const first = reportClientError({ kind: 'RENDER', error: new Error('same') });
    const second = reportClientError({ kind: 'RENDER', error: new Error('same') });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The boundary shows whatever it is given, so a suppressed duplicate must still be identified.
    expect(second).not.toBe(first);
    expect(second).toBeTruthy();
  });

  it('treats the same message under a different kind as a different fault', async () => {
    const { reportClientError } = await freshReporter();

    reportClientError({ kind: 'RENDER', error: new Error('same') });
    reportClientError({ kind: 'UNCAUGHT', error: new Error('same') });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('spends its whole allowance on a storm and then stops', async () => {
    const { reportClientError } = await freshReporter();

    for (let i = 0; i < 25; i += 1) {
      reportClientError({ kind: 'RENDER', error: new Error(`fault ${i}`) });
    }

    // A render loop can throw many times a second; the endpoint is rate limited anyway, but a
    // browser firing hundreds of requests at a screen that is already broken helps nobody.
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('earns the allowance back, so a long-lived tab does not go silent for good', async () => {
    vi.useFakeTimers();
    try {
      const { reportClientError } = await freshReporter();

      for (let i = 0; i < 12; i += 1) {
        reportClientError({ kind: 'RENDER', error: new Error(`storm ${i}`) });
      }
      expect(fetchMock).toHaveBeenCalledTimes(10);

      // Nothing yet: not enough time has passed to have earned one back.
      vi.advanceTimersByTime(60_000);
      reportClientError({ kind: 'RENDER', error: new Error('too soon') });
      expect(fetchMock).toHaveBeenCalledTimes(10);

      // Two minutes buys exactly one.
      vi.advanceTimersByTime(60_000);
      reportClientError({ kind: 'RENDER', error: new Error('earned one') });
      expect(fetchMock).toHaveBeenCalledTimes(11);

      reportClientError({ kind: 'RENDER', error: new Error('and no more') });
      expect(fetchMock).toHaveBeenCalledTimes(11);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never banks more than one burst, however long the tab sits idle', async () => {
    vi.useFakeTimers();
    try {
      const { reportClientError } = await freshReporter();

      vi.advanceTimersByTime(24 * 60 * 60_000);
      for (let i = 0; i < 25; i += 1) {
        reportClientError({ kind: 'RENDER', error: new Error(`after a day ${i}`) });
      }

      expect(fetchMock).toHaveBeenCalledTimes(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it('trims what it sends to the caps the server enforces', async () => {
    const error = new Error('m'.repeat(2_000));
    error.stack = 's'.repeat(20_000);
    const { reportClientError } = await freshReporter();

    reportClientError({ kind: 'RENDER', error, componentStack: 'c'.repeat(20_000) });

    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.message).toHaveLength(1_000);
    expect(body.stack).toHaveLength(8_000);
    expect(body.componentStack).toHaveLength(8_000);
  });

  it('logs to the console whatever happens to the request', async () => {
    // The console line is the only record when reporting is blocked, so it is written first and
    // unconditionally rather than in the request's success path.
    fetchMock.mockRejectedValue(new Error('blocked'));
    const { reportClientError } = await freshReporter();

    reportClientError({ kind: 'RENDER', error: new Error('boom') });

    expect(console.error).toHaveBeenCalled();
  });

  /*
    The window handlers attach to a window this file shares across cases, so these measure what one
    dispatch adds rather than the absolute call count — which would depend on how many earlier
    cases had installed.
  */
  it('reports a rejected promise nobody caught', async () => {
    const { installClientErrorReporting } = await freshReporter();
    installClientErrorReporting();

    const before = fetchMock.mock.calls.length;
    // Boundaries never see these — that is the whole reason the window handlers exist.
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('nobody caught me') }),
    );

    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    expect(bodyOf(fetchMock.mock.calls[before])).toMatchObject({
      kind: 'UNHANDLED_REJECTION',
      message: 'nobody caught me',
    });
  });

  it('reports an uncaught throw, and ignores a failed asset', async () => {
    const { installClientErrorReporting } = await freshReporter();
    installClientErrorReporting();

    const before = fetchMock.mock.calls.length;
    window.dispatchEvent(Object.assign(new Event('error'), { error: new Error('from a timer') }));
    const afterThrow = fetchMock.mock.calls.length;

    // A broken <img> or a chunk that 404s fires the same event with no Error on it. That is a
    // network problem, not a fault in the code, and belongs in the network tab.
    window.dispatchEvent(new Event('error'));
    const afterAsset = fetchMock.mock.calls.length;

    expect(afterThrow).toBeGreaterThan(before);
    expect(bodyOf(fetchMock.mock.calls[before]).kind).toBe('UNCAUGHT');
    expect(afterAsset).toBe(afterThrow);
  });

  it('ignores a second install rather than filing everything twice', async () => {
    // Counted at the source rather than by dispatching: earlier cases in this file have already
    // left their own listeners on the shared window, so what is being proven is that this module
    // adds one pair and not two.
    const { installClientErrorReporting } = await freshReporter();
    const addSpy = vi.spyOn(window, 'addEventListener');

    installClientErrorReporting();
    const afterFirst = addSpy.mock.calls.length;
    installClientErrorReporting();

    expect(afterFirst).toBe(2);
    expect(addSpy.mock.calls.length).toBe(afterFirst);
  });

  it('mints a usable reference without crypto.randomUUID', async () => {
    // Present in every secure context the app runs in; the fallback exists so a missing API
    // degrades to a usable reference rather than to no report at all.
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const { reportClientError } = await freshReporter();
      const reference = reportClientError({ kind: 'RENDER', error: new Error('boom') });

      expect(reference).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

/**
 * The reference is what a person is told to quote, so minting it is the one step that must survive
 * anything. `randomUUID` needs a secure context and `getRandomValues` does not, so the two are not
 * interchangeable and the guard has to cover both.
 */
describe('minting a reference', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to random bytes where randomUUID is unavailable', async () => {
    // Plain HTTP: crypto is there, the secure-context-only method is not.
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const { reportClientError } = await freshReporter();

    const reference = reportClientError({ kind: 'UNCAUGHT', error: new Error('no randomUUID') });

    expect(reference).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('still returns a usable reference with no crypto at all', async () => {
    /*
      This threw before, out of a function documented as never throwing — which would have turned
      one fault into two, from inside a window handler where the second has nowhere to go.
    */
    vi.stubGlobal('crypto', undefined);
    const { reportClientError } = await freshReporter();

    const reference = reportClientError({ kind: 'RENDER', error: new Error('no crypto') });

    expect(reference).toBeTruthy();
    expect(reference.length).toBeGreaterThan(8);
  });

  it('does not throw when the fault itself is what broke crypto', async () => {
    vi.stubGlobal('crypto', undefined);
    const { reportClientError } = await freshReporter();

    expect(() => reportClientError({ kind: 'UNHANDLED_REJECTION', error: 'boom' })).not.toThrow();
  });
});
