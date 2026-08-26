import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate'. A silent activation reloads the page whenever a deploy lands,
      // and this product is one people type journal entries into — losing a half-filled voucher to
      // an invisible update is worse than asking. PwaUpdatePrompt renders the ask.
      registerType: 'prompt',
      manifest: {
        name: 'KBiz360 OWM',
        short_name: 'OWM',
        description: 'Owners Wealth Management — accounting books, statements and reports.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Both drawn from the light palette in app/styles/globals.css, so the splash screen and the
        // window chrome meet the app already wearing its own colours rather than the browser's.
        theme_color: '#1a52c4',
        background_color: '#f6f6f7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android crops every icon to its own silhouette. Without a maskable variant it crops
            // the square one instead, and the wordmark loses its corners.
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The shell only. Accounting figures are never served from the cache — see the note on
        // navigateFallbackDenylist below.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // The API is same-origin (`/api/v1`, proxied by nginx — see DEPLOY.md), so it falls inside
        // the worker's scope. Without this the navigation fallback answers an offline API call with
        // index.html, and axios reports a JSON parse error instead of a network failure. The
        // denylist lets those requests fail as themselves.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // `vite preview` serves the production bundle, and that bundle calls a *relative* /api/v1 —
  // .env.production says so, because on the box nginx proxies /api/ to the backend and no host
  // needs baking in. Preview has no such rule and answers those calls with its own 404, which the
  // login screen reports as "Invalid email or password" — a correct password looks rejected.
  //
  // This stands in for the nginx /api/ block so the built app can be tested locally against a real
  // backend. It applies to `vite preview` only; `npm run dev` reads an absolute URL from .env and
  // never comes through here.
  preview: {
    proxy: {
      '/api': {
        target: process.env.VITE_PREVIEW_API_TARGET ?? 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
