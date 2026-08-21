import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Node by default, jsdom where a test asks for it.
 *
 * Most of what is worth testing is pure logic — the money and date maths, the CSV escaping, the
 * number preview — which is where a silent wrong answer reaches a financial statement, and none of
 * it needs a DOM. The pieces that do, such as the theme control writing an attribute onto <html>
 * or a menu moving focus, opt in per file with:
 *
 *     // @vitest-environment jsdom
 *
 * so the fast default is not paid for by every test.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
