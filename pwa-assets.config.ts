import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * How public/kb360-logo.png — the KBiz360 pinwheel app icon — becomes the installed-app icon set
 * and the favicon. Run with `npm run icons`; every pwa-*.png, maskable-icon-512x512.png,
 * apple-touch-icon-180x180.png and favicon.ico under public/ comes from it, so it is the only one
 * to replace. The generator writes beside its source, which is why the source is in public/;
 * vite.config.ts keeps it out of the offline cache, since the app itself never shows it.
 *
 * This is the stock minimal-2023 preset with two changes, both to the maskable and Apple icons.
 * The preset draws those inset, so a platform cropping the icon to its own silhouette never cuts
 * the artwork. This logo already carries that margin — the pinwheel reaches 30% of the width from
 * the centre, inside the 40% every platform keeps — so the inset is dropped (insetting again only
 * shrank the wheel on a home screen); and its transparent corners are filled with the logo's own
 * ground rather than the preset's white, so the square and the field around it are one.
 */
const LOGO_GROUND = '#0c0e14';

export default defineConfig({
  images: ['public/kb360-logo.png'],
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { ...minimal2023Preset.maskable.resizeOptions, background: LOGO_GROUND },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { ...minimal2023Preset.apple.resizeOptions, background: LOGO_GROUND },
    },
  },
});
