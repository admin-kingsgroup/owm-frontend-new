import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Node environment, deliberately.
 *
 * These cover the pure logic — the money and date maths, the CSV escaping, the number preview —
 * which is where a silent wrong answer can reach a financial statement. Rendering components would
 * need jsdom and a testing library on top; that is a separate decision, and this suite is useful
 * without it.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
