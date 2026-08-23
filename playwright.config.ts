import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from '@playwright/test';

/**
 * Browser checks, for the faults that only exist once the thing is drawn.
 *
 * The unit suites cover logic and the backend's HTTP suite covers wiring; neither can see a column
 * squeezed to nothing, a strip running off the edge, or a statement whose figures do not line up.
 * Those reached the user twice before anyone caught them, which is what this exists to stop.
 *
 * It drives the real app against a real API rather than mounting components in isolation: the
 * failures worth catching are failures of the whole page — layout, theme, and the shell around the
 * screen — and a component harness cannot show any of them.
 *
 * Both servers are started here, and the API is given a throwaway in-memory replica set of its own
 * on a port of its own. That matters for more than isolation: account creation is closed to
 * everyone but an administrator, and the *first* account on an empty database is the one that
 * bootstraps as administrator — so a fresh database is what lets these checks sign in at all,
 * without anybody's real credentials being needed or stored.
 */
const API_PORT = 5099;
const backendDir = fileURLToPath(new URL('../OWM-ADB Backend', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  // One worker: the specs seed a company through the API and would otherwise race each other.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:5173',
    // Desktop first, which is what this product is. Narrow widths are set per test.
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: [
    {
      command: 'npx tsx scripts/run-live.mts',
      cwd: backendDir,
      env: { PORT: String(API_PORT), NODE_ENV: 'development' },
      url: `http://localhost:${API_PORT}/api/v1/health`,
      /*
        Never inherited, and this is the more painful half of a real trade.

        Reuse was here because an aborted run leaves this process behind — Playwright kills what it
        spawned, but not always the grandchild a package runner starts — so the next run would fail
        on the port rather than on anything real. What that bought was worse: the run inherits a
        server it does not own, and when the aborted run's process tree is finally reaped, that
        server dies *mid-suite*. Every request after it fails, the app treats an unreachable API as
        nobody being signed in, and the rest of the run fails as a missing button or a heading that
        never appeared. It reads exactly like an application bug. It cost three separate diagnoses
        before the cause was the harness both times.

        Refusing to inherit turns that into "port already in use" before a single test runs — which
        is the same underlying problem, said out loud, one process to kill. A failure at start-up
        that names itself beats a failure halfway through that blames the product.

        It also gives every run its own database rather than the last run's, so what a screen shows
        is what this run seeded.
      */
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
      // The in-memory replica set downloads a mongod on first use.
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      env: { VITE_API_BASE_URL: `http://localhost:${API_PORT}/api/v1` },
      url: 'http://localhost:5173',
      // Same reasoning as the API above: owned by this run, or not used.
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
