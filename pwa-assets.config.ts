import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * How public/icon.svg becomes the installed-app icon set. Run with `npm run icons`.
 *
 * This is the stock minimal-2023 preset with one change. The maskable and Apple icons are drawn
 * inset, so that a platform cropping the icon to its own silhouette never cuts the artwork — and
 * the preset fills the resulting margin with white. Against our blue that reads as a white frame
 * around the icon on both an Android launcher and an iOS home screen. Padding the ground with the
 * same blue as the artwork makes the inset invisible, which is the point of it.
 */
const BRAND_BLUE = '#1a52c4';

export default defineConfig({
  images: ['public/icon.svg'],
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { ...minimal2023Preset.maskable.resizeOptions, background: BRAND_BLUE },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { ...minimal2023Preset.apple.resizeOptions, background: BRAND_BLUE },
    },
  },
});
